import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { useWorkspace } from '../auth/useWorkspace'
import { signOut } from '../services/authService'
import { useI18n } from '../i18n'
import { LanguageSwitcher } from '../components/LanguageSwitcher'

/** Para cuentas que iniciaron sesión pero no tienen acceso activo al espacio. */
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
      setSignOutError(error instanceof Error ? error.message : 'No se pudo cerrar la sesión.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <aside className="auth__brand">
        <img alt="" height="88" src="/icons/icon-512.png" width="88" />
        <p className="auth__name">Novo Norte</p>
        <p className="auth__tagline">{t('Registro de atenciones')}</p>
      </aside>
      <main className="auth__main">
        <div className="auth__language"><LanguageSwitcher /></div>
        <section className="auth__card">
          <h1>{connectionProblem ? t('No pudimos comprobar tu acceso') : t('Todavía no tienes acceso')}</h1>
          <p className="auth__lead">
            {connectionProblem
              ? t('Revisa tu conexión a internet e inténtalo de nuevo.')
              : t('Pide a un administrador que habilite tu cuenta. Cuando lo haga, pulsa el botón de abajo.')}
          </p>
          {user?.email && <p className="auth__note">{t('Cuenta: {email}', { email: user.email })}</p>}
          {signOutError && <p className="message message--error" role="alert">{t(signOutError)}</p>}
          <div className="form-stack">
            <button className="button button--primary button--large" onClick={refresh} type="button">
              {connectionProblem ? t('Reintentar') : t('Ya me dieron acceso')}
            </button>
            <button className="link-button" disabled={busy} onClick={() => void handleSignOut()} type="button">
              {busy ? t('Cerrando sesión…') : t('Entrar con otra cuenta')}
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
