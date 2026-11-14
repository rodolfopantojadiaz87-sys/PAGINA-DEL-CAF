import type { Session, User } from '@supabase/supabase-js'
import { requireSupabase } from '../lib/supabase'

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

export async function completeInvitedProfile(fullName: string): Promise<void> {
  const user = (await getCurrentSession())?.user
  if (!user) throw new Error('La invitación expiró. Abre de nuevo el enlace del correo.')

  const { error } = await requireSupabase()
    .from('profiles')
    .update({ full_name: fullName.trim() })
    .eq('id', user.id)
  throwIfError(error)

  const { error: invitationError } = await requireSupabase()
    .rpc('accept_workspace_invitation')
  throwIfError(invitationError)

  const url = new URL(window.location.href)
  if (url.searchParams.get('type') === 'invite') {
    url.searchParams.delete('type')
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    )
  }
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

function throwIfError(error: { message: string } | null): void {
  if (error) throw error
}
