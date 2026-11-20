import { useState } from 'react'
import { LockKeyhole, WifiOff } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { useWorkspace } from '../auth/useWorkspace'
import { signOut } from '../services/authService'
import { useI18n } from '../i18n'
import { LanguageSwitcher } from '../components/LanguageSwitcher'

/** Pantalla para cuentas que iniciaron sesión pero no tienen acceso activo al espacio. */
export function WorkspaceGatePage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { access, refresh } = useWorkspace()
  const [busy, setBusy] = useState(false)
  const [signOutError, setSignOutError] = useState<string>()
  const connectionProblem = access.status === 'error'

  async function handleSignOut() {
    setBusy(true)
    setSignOutError(undefined)
    try {
      await signOut()
    } catch (error: unknown) {
      setSignOutError(
        error instanceof Error ? error.message : 'No se pudo cerrar la sesión.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <LanguageSwitcher />
      <section className="auth-card auth-card--notice">
        <span className="auth-card__icon">
          {connectionProblem ? <WifiOff size={26} /> : <LockKeyhole size={26} />}
        </span>
        <h1>
          {connectionProblem
            ? t('No pudimos comprobar tu acceso')
            : t('Todavía no tienes acceso')}
        </h1>
        <p>
          {connectionProblem
            ? t('Revisa tu conexión a internet e inténtalo de nuevo.')
            : t('Pide a un administrador que habilite tu cuenta. Cuando lo haga, pulsa el botón de abajo.')}
        </p>
        {user?.email && <p className="auth-card__footnote">{user.email}</p>}

        {signOutError && <p className="auth-error" role="alert">{t(signOutError)}</p>}
        <button className="auth-button" onClick={refresh} type="button">
          {connectionProblem ? t('Reintentar') : t('Ya me dieron acceso')}
        </button>
        <button className="auth-link" disabled={busy} onClick={() => void handleSignOut()} type="button">
          {busy ? t('Cerrando sesión…') : t('Entrar con otra cuenta')}
        </button>
      </section>
    </div>
  )
}
