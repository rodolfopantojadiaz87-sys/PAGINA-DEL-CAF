import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured } from '../lib/supabase'
import { getCurrentSession, subscribeToAuthChanges } from '../services/authService'
import { AuthContext, type AuthContextValue } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [invitationAcceptance, setInvitationAcceptance] = useState(isInvitationLink)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!isSupabaseConfigured) return

    let active = true
    let authEventObserved = false
    const unsubscribe = subscribeToAuthChanges((nextSession, event) => {
      if (!active) return
      authEventObserved = true
      setSession(nextSession)
      setLoading(false)
      setError(undefined)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      if (event === 'SIGNED_IN') setPasswordRecovery(false)
      if (event === 'SIGNED_OUT') {
        setPasswordRecovery(false)
        setInvitationAcceptance(false)
      }
    })

    void getCurrentSession()
      .then((currentSession) => {
        if (active && !authEventObserved) setSession(currentSession)
      })
      .catch((sessionError: unknown) => {
        if (active) {
          setError(
            sessionError instanceof Error
              ? sessionError.message
              : 'No se pudo verificar la sesión.',
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      session,
      user: session?.user ?? null,
      passwordRecovery,
      invitationAcceptance,
    }),
    [invitationAcceptance, loading, passwordRecovery, session],
  )

  if (error) {
    return (
      <AuthContext.Provider value={value}>
        <div className="auth-page">
          <section className="auth-card" role="alert">
            <h1>No se pudo verificar la sesión</h1>
            <p>{error}</p>
            <p>Comprueba la conexión con Supabase y vuelve a cargar la página.</p>
          </section>
        </div>
      </AuthContext.Provider>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function isInvitationLink(): boolean {
  const hashParams = new URLSearchParams(window.location.hash.slice(1))
  const queryParams = new URLSearchParams(window.location.search)
  return hashParams.get('type') === 'invite' || queryParams.get('type') === 'invite'
}
