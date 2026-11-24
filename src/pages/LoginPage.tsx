import { useState, type FormEvent } from 'react'
import {
  initialAuthRedirect,
  requestPasswordRecovery,
  signInWithEmail,
  signOut,
  updatePassword,
} from '../services/authService'
import { useAuth } from '../auth/useAuth'
import { useI18n } from '../i18n'
import { LanguageSwitcher } from '../components/LanguageSwitcher'

type AuthMode = 'sign-in' | 'recovery' | 'update-password'

export function LoginPage() {
  const { t } = useI18n()
  const { configured, user, passwordRecovery } = useAuth()
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | undefined>(initialAuthRedirect.error ?? undefined)
  const [notice, setNotice] = useState<string>()
  const [busy, setBusy] = useState(false)
  // Crear contraseña solo tiene sentido con la sesión temporal que abre el enlace del correo.
  const activeMode = passwordRecovery && user ? 'update-password' : mode

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(undefined)
    setNotice(undefined)
    setBusy(true)

    try {
      if (activeMode === 'recovery') {
        await requestPasswordRecovery(email)
        setNotice('Si la cuenta existe, recibirás un correo con instrucciones para recuperar el acceso.')
      } else if (activeMode === 'update-password') {
        if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.')
        if (password !== confirmation) throw new Error('Las contraseñas no coinciden.')
        await updatePassword(password)
        await signOut()
        setPassword('')
        setConfirmation('')
        setMode('sign-in')
        setNotice('Contraseña actualizada. Ya puedes iniciar sesión.')
      } else {
        await signInWithEmail(email, password)
      }
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'No se pudo completar la operación. Inténtalo de nuevo.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleSignOut() {
    setError(undefined)
    setBusy(true)
    try {
      await signOut()
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'No se pudo cerrar la sesión.',
      )
    } finally {
      setBusy(false)
    }
  }

  const isRecovery = activeMode === 'recovery'
  const isPasswordUpdate = activeMode === 'update-password'
  const title = isPasswordUpdate
    ? t('Crear contraseña nueva')
    : isRecovery
      ? t('Recuperar acceso')
      : t('Iniciar sesión')

  const accessEmail = import.meta.env.VITE_ACCESS_REQUEST_EMAIL?.trim()

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
          <h1>{title}</h1>
          <p className="auth__lead">
            {isRecovery
              ? t('Te enviaremos un enlace al correo de tu cuenta para crear una contraseña nueva.')
              : isPasswordUpdate
                ? t('Elige una contraseña de al menos 6 caracteres.')
                : t('Entra con el correo y la contraseña que te dio la administración.')}
          </p>

          {!configured && (
            <p className="message message--warning" role="alert">
              {t('Supabase todavía no está configurado. Define')} <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> {t('en un archivo')} <code>.env.local</code> {t('y reinicia Vite.')}
            </p>
          )}

          <form className="form-stack" onSubmit={(event) => void handleSubmit(event)}>
            {!isPasswordUpdate && (
              <label className="field">
                <span>{t('Correo electrónico')}</span>
                <input autoComplete="email" disabled={!configured || busy} onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
              </label>
            )}
            {!isRecovery && (
              <label className="field">
                <span>{t(isPasswordUpdate ? 'Contraseña nueva' : 'Contraseña')}</span>
                <input autoComplete={isPasswordUpdate ? 'new-password' : 'current-password'} disabled={!configured || busy} minLength={6} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
              </label>
            )}
            {isPasswordUpdate && (
              <label className="field">
                <span>{t('Repetir contraseña nueva')}</span>
                <input autoComplete="new-password" disabled={!configured || busy} minLength={6} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} />
              </label>
            )}
            {error && <p className="message message--error" role="alert">{t(error)}</p>}
            {notice && <p className="message message--success" role="status">{t(notice)}</p>}
            <button className="button button--primary button--large" disabled={!configured || busy} type="submit">
              {busy
                ? t('Procesando…')
                : isRecovery
                  ? t('Enviar enlace')
                  : isPasswordUpdate
                    ? t('Guardar contraseña')
                    : t('Entrar')}
            </button>
          </form>

          <div className="auth__links">
            {!isPasswordUpdate && (
              <button
                className="link-button"
                disabled={busy}
                onClick={() => {
                  setMode(isRecovery ? 'sign-in' : 'recovery')
                  setError(undefined)
                  setNotice(undefined)
                }}
                type="button"
              >
                {isRecovery ? t('Volver a iniciar sesión') : t('¿Olvidaste tu contraseña?')}
              </button>
            )}
            {isPasswordUpdate && (
              <button className="link-button" disabled={busy} onClick={() => void handleSignOut()} type="button">
                {t('Cancelar y volver al inicio de sesión')}
              </button>
            )}
          </div>
          {!isRecovery && !isPasswordUpdate && (
            <p className="auth__note">
              {t('¿No tienes cuenta? La crea un administrador del centro.')}
              {accessEmail && (
                <>
                  {' '}
                  <a href={`mailto:${encodeURIComponent(accessEmail).replace(/%40/gi, '@')}?subject=${encodeURIComponent(t('Solicitud de acceso a Atenciones'))}`}>{t('Pedir acceso por correo')}</a>
                </>
              )}
            </p>
          )}
        </section>
      </main>
    </div>
  )
}
