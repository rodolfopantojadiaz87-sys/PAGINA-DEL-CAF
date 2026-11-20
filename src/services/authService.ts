import type { Session, User } from '@supabase/supabase-js'
import { requireSupabase } from '../lib/supabase'

export interface AuthRedirect {
  type: 'recovery' | null
  error: string | null
}

// Se lee al cargar el módulo: Supabase limpia la URL al procesar el enlace, y el
// evento PASSWORD_RECOVERY puede emitirse antes de que React se suscriba.
export const initialAuthRedirect: AuthRedirect = readAuthRedirect()

function readAuthRedirect(): AuthRedirect {
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const query = new URLSearchParams(window.location.search)
  const type = hash.get('type') ?? query.get('type')
  const errorCode = hash.get('error_code') ?? query.get('error_code')
  const hasError = Boolean(errorCode || hash.get('error') || query.get('error'))
  return {
    type: type === 'recovery' ? type : null,
    error: !hasError
      ? null
      : errorCode === 'otp_expired'
        ? 'El enlace expiró o ya se usó. Solicita uno nuevo.'
        : 'El enlace no es válido. Solicita uno nuevo.',
  }
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'La cuenta todavía no confirmó su correo.',
  user_banned: 'Esta cuenta está bloqueada. Contacta a la administración.',
  over_request_rate_limit: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  over_email_send_rate_limit: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  same_password: 'La contraseña nueva debe ser distinta de la anterior.',
  weak_password: 'La contraseña es demasiado débil. Usa al menos 6 caracteres.',
  session_not_found: 'La sesión expiró. Inicia sesión o solicita un enlace nuevo.',
  session_expired: 'La sesión expiró. Inicia sesión o solicita un enlace nuevo.',
  refresh_token_not_found: 'La sesión expiró. Inicia sesión o solicita un enlace nuevo.',
  otp_expired: 'El enlace expiró o ya se usó. Solicita uno nuevo.',
}

export interface AuthResult {
  session: Session | null
  user: User
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  const { data, error } = await requireSupabase().auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  throwIfError(error)
  if (!data.user) throw new Error('Supabase no devolvió el usuario autenticado.')
  return { session: data.session, user: data.user }
}

export async function requestPasswordRecovery(email: string): Promise<void> {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin,
  })
  throwIfError(error)
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await requireSupabase().auth.updateUser({ password })
  throwIfError(error)
}

export async function signOut(): Promise<void> {
  const { error } = await requireSupabase().auth.signOut()
  throwIfError(error)
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await requireSupabase().auth.getSession()
  throwIfError(error)
  return data.session
}

export function subscribeToAuthChanges(
  listener: (session: Session | null, event: string) => void,
): () => void {
  const { data } = requireSupabase().auth.onAuthStateChange((event, session) => {
    listener(session, event)
  })
  return () => data.subscription.unsubscribe()
}

/** Traduce los errores de Supabase Auth (en inglés) a mensajes comprensibles. */
function throwIfError(
  error: { message: string; code?: string; name?: string } | null,
): void {
  if (!error) return
  const known = error.code ? AUTH_ERROR_MESSAGES[error.code] : undefined
  if (known) throw new Error(known)
  if (error.name === 'AuthSessionMissingError') {
    throw new Error(AUTH_ERROR_MESSAGES.session_not_found)
  }
  if (error.name === 'AuthRetryableFetchError') {
    throw new Error('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.')
  }
  throw error
}
