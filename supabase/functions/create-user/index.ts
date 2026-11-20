import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@^2/cors'

const workspaceId = '11111111-1111-4111-8111-111111111111'

/**
 * Crea un miembro del espacio en un solo paso: el administrador indica nombre,
 * correo, contraseña y rol, y la persona puede entrar de inmediato con esos datos.
 * Si el correo ya tiene cuenta (por ejemplo, alguien a quien se quitó antes), se
 * le asignan la contraseña y el rol nuevos y se reactiva su acceso.
 */
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido.' }, 405)
  }

  const accessToken = request.headers
    .get('Authorization')
    ?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!accessToken) {
    return jsonResponse({ error: 'Debes iniciar sesión como administrador.' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el servidor.')
    return jsonResponse({ error: 'La función de administración no está configurada.' }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: authenticated, error: authError } =
    await supabase.auth.getUser(accessToken)
  if (authError || !authenticated.user) {
    return jsonResponse({ error: 'La sesión no es válida o expiró.' }, 401)
  }

  const { data: requester, error: requesterError } = await supabase
    .from('workspace_members')
    .select('role, is_active')
    .eq('workspace_id', workspaceId)
    .eq('user_id', authenticated.user.id)
    .maybeSingle()
  if (requesterError) {
    console.error('No se pudo verificar el rol del solicitante:', requesterError.message)
    return jsonResponse({ error: 'No se pudo verificar el permiso de administración.' }, 500)
  }
  if (!requester || !requester.is_active || requester.role !== 'admin') {
    return jsonResponse({ error: 'Solo un administrador activo puede crear miembros.' }, 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'El cuerpo de la solicitud no es JSON válido.' }, 400)
  }

  const input =
    typeof body === 'object' && body !== null
      ? body as Record<string, unknown>
      : {}
  const fullName = typeof input.full_name === 'string' ? input.full_name.trim() : ''
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const role = input.role

  if (fullName.length < 1 || fullName.length > 120) {
    return jsonResponse({ error: 'Escribe un nombre de entre 1 y 120 caracteres.' }, 400)
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'Escribe un correo electrónico válido.' }, 400)
  }
  if (password.length < 6 || password.length > 72) {
    return jsonResponse({ error: 'La contraseña debe tener entre 6 y 72 caracteres.' }, 400)
  }
  if (role !== 'admin' && role !== 'attendant') {
    return jsonResponse({ error: 'Selecciona un rol válido.' }, 400)
  }

  let existingUser: Awaited<ReturnType<typeof findAuthUserByEmail>>
  try {
    existingUser = await findAuthUserByEmail(supabase, email)
  } catch (lookupError) {
    console.error(
      'No se pudo comprobar si la cuenta ya existe:',
      lookupError instanceof Error ? lookupError.message : lookupError,
    )
    return jsonResponse({ error: 'No se pudo verificar el estado de la cuenta.' }, 500)
  }

  const { data: existingMembership, error: membershipLookupError } = existingUser
    ? await supabase
      .from('workspace_members')
      .select('id, is_active')
      .eq('workspace_id', workspaceId)
      .eq('user_id', existingUser.id)
      .maybeSingle()
    : { data: null, error: null }
  if (membershipLookupError) {
    console.error('No se pudo consultar la membresía existente:', membershipLookupError.message)
    return jsonResponse({ error: 'No se pudo verificar la membresía existente.' }, 500)
  }
  // No se cambia en silencio la contraseña de alguien que ya está usando el sistema.
  if (existingMembership?.is_active) {
    return jsonResponse(
      { error: 'Este correo ya pertenece a un miembro activo. Cambia su rol desde la lista.' },
      409,
    )
  }

  let userId: string
  let createdNewAccount = false
  if (existingUser) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true,
      user_metadata: { ...existingUser.user_metadata, full_name: fullName },
    })
    if (updateError) {
      console.error('No se pudo actualizar la cuenta existente:', updateError.message)
      return jsonResponse({ error: updateError.message }, 400)
    }
    userId = existingUser.id
  } else {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (createError || !created.user) {
      console.error('Supabase no pudo crear la cuenta:', createError?.message)
      return jsonResponse({ error: createError?.message ?? 'No se pudo crear la cuenta.' }, 400)
    }
    userId = created.user.id
    createdNewAccount = true
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: userId, full_name: fullName, email }, { onConflict: 'id' })
  const { error: membershipError } = profileError
    ? { error: profileError }
    : existingMembership
      ? await supabase
        .from('workspace_members')
        .update({ role, is_active: true, invitation_accepted_at: new Date().toISOString() })
        .eq('id', existingMembership.id)
      : await supabase.from('workspace_members').insert({
        workspace_id: workspaceId,
        user_id: userId,
        role,
        is_active: true,
        invitation_accepted_at: new Date().toISOString(),
      })
  if (membershipError) {
    console.error('No se pudo asignar la cuenta al espacio:', membershipError.message)
    if (createdNewAccount) {
      const { error: cleanupError } = await supabase.auth.admin.deleteUser(userId)
      if (cleanupError) {
        console.error('No se pudo limpiar la cuenta sin membresía:', cleanupError.message)
      }
    }
    return jsonResponse(
      { error: 'No se pudo asignar la cuenta al espacio. Contacta al administrador técnico.' },
      500,
    )
  }

  return jsonResponse({ created: true }, 200)
})

async function findAuthUserByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
) {
  const perPage = 1000
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const match = data.users.find(
      (user) => user.email?.toLowerCase() === email,
    )
    if (match) return match
    if (data.users.length < perPage) return null
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
