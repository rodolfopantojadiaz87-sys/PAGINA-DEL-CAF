import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  getCurrentSession,
  initialAuthRedirect,
  subscribeToAuthChanges,
} from '../services/authService'
import { AuthContext, type AuthContextValue } from './authContext'
import { useI18n } from '../i18n'
import { LanguageSwitcher } from '../components/LanguageSwitcher'

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [passwordRecovery, setPasswordRecovery] = useState(
    () => initialAuthRedirect.type === 'recovery' && !initialAuthRedirect.error,
  )
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
      // Supabase también emite SIGNED_IN al volver a la pestaña; no debe cancelar
      // la recuperación, o el usuario entraría sin haber creado la contraseña nueva.
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      if (event === 'SIGNED_OUT') {
        setPasswordRecovery(false)
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
    }),
    [loading, passwordRecovery, session],
  )

  if (error) {
    return (
      <AuthContext.Provider value={value}>
        <div className="splash">
          <LanguageSwitcher />
          <section className="auth__card" role="alert">
            <h1>{t('No se pudo verificar la sesión')}</h1>
            <p>{t(error)}</p>
            <p>{t('Comprueba la conexión con Supabase y vuelve a cargar la página.')}</p>
            <button className="button button--primary" onClick={() => window.location.reload()} type="button">
              {t('Reintentar')}
            </button>
          </section>
        </div>
      </AuthContext.Provider>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
