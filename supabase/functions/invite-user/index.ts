import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const workspaceId = '11111111-1111-4111-8111-111111111111'

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido.' }, 405)
  }

  const authorization = request.headers.get('Authorization')
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!accessToken) {
    return jsonResponse({ error: 'Debes iniciar sesión como administrador.' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const appSiteUrl = Deno.env.get('APP_SITE_URL')
  if (!supabaseUrl || !serviceRoleKey || !appSiteUrl) {
    console.error('Falta SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o APP_SITE_URL en el servidor.')
    return jsonResponse({ error: 'La función de invitaciones no está configurada.' }, 500)
  }

  let redirectTo: string
  try {
    const appUrl = new URL(appSiteUrl)
    const isLocalHttp =
      appUrl.protocol === 'http:' &&
      (appUrl.hostname === 'localhost' || appUrl.hostname === '127.0.0.1')
    if (appUrl.protocol !== 'https:' && !isLocalHttp) {
      return jsonResponse({ error: 'APP_SITE_URL debe usar HTTPS fuera del entorno local.' }, 500)
    }
    if (appUrl.username || appUrl.password) {
      return jsonResponse({ error: 'APP_SITE_URL no debe incluir credenciales.' }, 500)
    }
    redirectTo = new URL('/?type=invite', appUrl.origin).toString()
  } catch {
    return jsonResponse({ error: 'APP_SITE_URL no es una URL válida.' }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: authenticated, error: authError } = await supabase.auth.getUser(accessToken)
  if (authError || !authenticated.user) {
    return jsonResponse({ error: 'La sesión no es válida o expiró.' }, 401)
  }

  const { data: membership, error: membershipError } = await supabase
    .from('workspace_members')
    .select('role, is_active')
    .eq('workspace_id', workspaceId)
    .eq('user_id', authenticated.user.id)
    .maybeSingle()
  if (membershipError) {
    console.error('No se pudo verificar el rol del solicitante:', membershipError.message)
    return jsonResponse({ error: 'No se pudo verificar el permiso de administración.' }, 500)
  }
  if (!membership || !membership.is_active || membership.role !== 'admin') {
    return jsonResponse({ error: 'Solo un administrador activo puede invitar colaboradores.' }, 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'El cuerpo de la solicitud no es JSON válido.' }, 400)
  }
  const email =
    typeof body === 'object' && body !== null && 'email' in body &&
      typeof body.email === 'string'
      ? body.email.trim().toLowerCase()
      : ''
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return jsonResponse({ error: 'Escribe un correo electrónico válido.' }, 400)
  }

  const { data: invitation, error: inviteError } =
    await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { full_name: email.split('@')[0] },
    })
  if (inviteError || !invitation.user) {
    console.error('Supabase no pudo invitar la cuenta:', inviteError?.message)
    return jsonResponse(
      { error: inviteError?.message ?? 'No se pudo crear la invitación.' },
      inviteError?.status === 422 ? 409 : 400,
    )
  }

  const { error: insertError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspaceId,
      user_id: invitation.user.id,
      role: 'attendant',
      is_active: false,
      invitation_accepted_at: null,
    })
  if (insertError) {
    console.error('No se pudo crear la membresía invitada:', insertError.message)
    const { error: cleanupError } = await supabase.auth.admin.deleteUser(invitation.user.id)
    if (cleanupError) {
      console.error('No se pudo limpiar la cuenta cuya membresía falló:', cleanupError.message)
    }
    return jsonResponse({ error: 'La cuenta se creó, pero no se pudo asignar al espacio. Contacta al administrador técnico.' }, 500)
  }

  return jsonResponse({ invited: true }, 200)
})

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
