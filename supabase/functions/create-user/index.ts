import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@^2/cors'

const workspaceId = '11111111-1111-4111-8111-111111111111'

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
    return jsonResponse({ error: 'Solo un administrador activo puede crear cuentas.' }, 403)
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
  const action = input.action ?? 'create'
  const fullName = typeof input.full_name === 'string' ? input.full_name.trim() : ''
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const role = input.role

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'Escribe un correo electrónico válido.' }, 400)
  }
  if (role !== 'admin' && role !== 'attendant') {
    return jsonResponse({ error: 'Selecciona un rol válido.' }, 400)
  }

  if (action === 'link-existing') {
    let existingUser: Awaited<ReturnType<typeof findAuthUserByEmail>>
    try {
      existingUser = await findAuthUserByEmail(supabase, email)
    } catch (lookupError) {
      console.error(
        'No se pudo buscar la cuenta existente:',
        lookupError instanceof Error ? lookupError.message : lookupError,
      )
      return jsonResponse({ error: 'No se pudo verificar la cuenta existente.' }, 500)
    }
    if (!existingUser) {
      return jsonResponse(
        { error: 'No se encontró una cuenta registrada con ese correo.' },
        404,
      )
    }
    if (!existingUser.email_confirmed_at) {
      return jsonResponse(
        { error: 'La cuenta todavía no confirmó su correo. Completa primero la invitación o verificación pendiente.' },
        409,
      )
    }

    const { data: existingMembership, error: existingMembershipError } =
      await supabase
        .from('workspace_members')
        .select('id, is_active, invitation_accepted_at')
        .eq('workspace_id', workspaceId)
        .eq('user_id', existingUser.id)
        .maybeSingle()
    if (existingMembershipError) {
      console.error(
        'No se pudo consultar la membresía de la cuenta existente:',
        existingMembershipError.message,
      )
      return jsonResponse({ error: 'No se pudo verificar la membresía existente.' }, 500)
    }
    if (existingMembership?.is_active) {
      return jsonResponse(
        {
          error: 'Esta cuenta ya tiene acceso al espacio. Administra su rol desde la lista de miembros.',
          code: 'ALREADY_MEMBER',
        },
        409,
      )
    }

    const profileName =
      typeof existingUser.user_metadata?.full_name === 'string' &&
      existingUser.user_metadata.full_name.trim()
        ? existingUser.user_metadata.full_name.trim()
        : email.split('@')[0]
    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: existingUser.id,
        full_name: profileName,
        email,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    )
    if (profileError) {
      console.error(
        'No se pudo verificar el perfil de la cuenta existente:',
        profileError.message,
      )
      return jsonResponse({ error: 'No se pudo preparar el perfil de la cuenta.' }, 500)
    }

    const acceptedAt =
      existingMembership?.invitation_accepted_at ?? new Date().toISOString()
    const { error: membershipError } = existingMembership
      ? await supabase
        .from('workspace_members')
        .update({
          role,
          is_active: true,
          invitation_accepted_at: acceptedAt,
        })
        .eq('id', existingMembership.id)
      : await supabase.from('workspace_members').insert({
        workspace_id: workspaceId,
        user_id: existingUser.id,
        role,
        is_active: true,
        invitation_accepted_at: acceptedAt,
      })
    if (membershipError) {
      console.error(
        'No se pudo vincular la cuenta existente:',
        membershipError.message,
      )
      return jsonResponse(
        { error: 'No se pudo asignar la cuenta al espacio. Contacta al administrador técnico.' },
        500,
      )
    }

    return jsonResponse({ linked: true }, 200)
  }

  if (action !== 'create') {
    return jsonResponse({ error: 'La operación solicitada no es válida.' }, 400)
  }
  if (fullName.length < 1 || fullName.length > 120) {
    return jsonResponse({ error: 'Escribe un nombre de entre 1 y 120 caracteres.' }, 400)
  }
  if (password.length < 6 || password.length > 72) {
    return jsonResponse({ error: 'La contraseña debe tener entre 6 y 72 caracteres.' }, 400)
  }

  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
  if (createError || !created.user) {
    const indicatesDuplicateAccount =
      createError?.status === 422 ||
      /already (been )?registered|already exists/i.test(createError?.message ?? '')
    if (indicatesDuplicateAccount) {
      try {
        const existingUser = await findAuthUserByEmail(supabase, email)
        if (existingUser) {
          return jsonResponse(
            {
              error: 'Esta cuenta ya existe en Supabase. Puedes vincularla al espacio sin cambiar su contraseña.',
              code: 'ACCOUNT_ALREADY_EXISTS',
            },
            409,
          )
        }
      } catch (lookupError) {
        console.error(
          'No se pudo comprobar si la cuenta ya existe:',
          lookupError instanceof Error ? lookupError.message : lookupError,
        )
        return jsonResponse({ error: 'No se pudo verificar el estado de la cuenta.' }, 500)
      }
    }
    console.error('Supabase no pudo crear la cuenta:', createError?.message)
    return jsonResponse(
      { error: createError?.message ?? 'No se pudo crear la cuenta.' },
      createError?.status === 422 ? 409 : 400,
    )
  }

  const { error: membershipInsertError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspaceId,
      user_id: created.user.id,
      role,
      is_active: true,
      invitation_accepted_at: new Date().toISOString(),
    })
  if (membershipInsertError) {
    console.error('No se pudo crear la membresía de la cuenta:', membershipInsertError.message)
    const { error: cleanupError } =
      await supabase.auth.admin.deleteUser(created.user.id)
    if (cleanupError) {
      console.error('No se pudo limpiar la cuenta sin membresía:', cleanupError.message)
    }
    return jsonResponse({ error: 'No se pudo asignar la cuenta al espacio. Contacta al administrador técnico.' }, 500)
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
