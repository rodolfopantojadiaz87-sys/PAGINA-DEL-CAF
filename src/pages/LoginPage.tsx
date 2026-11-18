import { useState, type FormEvent } from 'react'
import { LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import {
  completeInvitedProfile,
  requestPasswordRecovery,
  signInWithEmail,
  signOut,
  updatePassword,
} from '../services/authService'
import { useAuth } from '../auth/useAuth'
import { useI18n } from '../i18n'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { capitalizeWords } from '../utils/textFormatting'

type AuthMode = 'sign-in' | 'recovery' | 'update-password'

export function LoginPage() {
  const { t } = useI18n()
  const { configured, user, passwordRecovery, invitationAcceptance } = useAuth()
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [fullName, setFullName] = useState('')
  const [accessRequestNotice, setAccessRequestNotice] = useState(false)
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [busy, setBusy] = useState(false)
  const activeMode = invitationAcceptance || passwordRecovery ? 'update-password' : mode

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
        if (invitationAcceptance && !fullName.trim()) {
          throw new Error('Escribe tu nombre para completar el perfil.')
        }
        await updatePassword(password)
        if (invitationAcceptance) await completeInvitedProfile(fullName)
        await signOut()
        setPassword('')
        setConfirmation('')
        setFullName('')
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

  if (user && activeMode !== 'update-password') {
    return (
      <div className="auth-page">
        <LanguageSwitcher />
        <section className="auth-card auth-card--notice">
          <span className="auth-card__icon"><ShieldCheck size={26} /></span>
          <p className="auth-card__eyebrow">{t('AUTENTICACIÓN COMPLETADA')}</p>
          <h1>{t('Conexión al espacio compartido pendiente')}</h1>
          <p>{t('Has iniciado sesión como')} <strong>{user.email}</strong>.</p>
          <div className="auth-message" role="status">
            {t('La autenticación está lista, pero los registros y permisos todavía no están conectados a Supabase. Los registros existentes siguen en este dispositivo y no se muestran para evitar exponerlos a otras cuentas.')}
          </div>
          {error && <p className="auth-error" role="alert">{t(error)}</p>}
          <button className="auth-button" disabled={busy} onClick={() => void handleSignOut()} type="button">
            {busy ? t('Cerrando sesión…') : t('Cerrar sesión')}
          </button>
        </section>
      </div>
    )
  }

  const isRecovery = activeMode === 'recovery'
  const isPasswordUpdate = activeMode === 'update-password'
  const title = isPasswordUpdate
    ? t('Crear contraseña nueva')
    : isRecovery
      ? t('Recuperar acceso')
      : t('Iniciar sesión')

  return (
    <div className="auth-page">
      <LanguageSwitcher />
      <section className="auth-card">
        <div className="auth-card__brand">
          <span className="auth-card__icon"><LockKeyhole size={25} /></span>
          <p className="auth-card__eyebrow">{t('SISTEMA PRIVADO')}</p>
        </div>
        <h1>{title}</h1>
        <p className="auth-card__description">
          {isRecovery
            ? t('Te enviaremos instrucciones al correo asociado a tu cuenta.')
            : invitationAcceptance
              ? t('Completa tu perfil y elige una contraseña de al menos 6 caracteres.')
            : isPasswordUpdate
              ? t('Elige una contraseña de al menos 6 caracteres.')
              : t('Usa las credenciales de tu cuenta autorizada.')}
        </p>

        {!configured && (
          <div className="auth-message auth-message--warning" role="alert">
            {t('Supabase todavía no está configurado. Define')}
            {' '}<code>VITE_SUPABASE_URL</code> y
            {' '}<code>VITE_SUPABASE_PUBLISHABLE_KEY</code> {t('en un archivo')}
            <code> .env.local</code> {t('y reinicia Vite.')}
          </div>
        )}

        <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
          {!isPasswordUpdate && (
            <label className="auth-field">
              <span>{t('Correo electrónico')}</span>
              <span className="auth-field__control">
                <Mail size={18} />
                <input
                  autoComplete="email"
                  disabled={!configured || busy}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </span>
            </label>
          )}
          {invitationAcceptance && (
            <label className="auth-field">
              <span>{t('Nombre y apellido')}</span>
              <input
                autoComplete="name"
                disabled={!configured || busy}
                onChange={(event) => setFullName(capitalizeWords(event.target.value))}
                autoCapitalize="words"
                required
                type="text"
                value={fullName}
              />
            </label>
          )}
          {!isRecovery && (
            <label className="auth-field">
              <span>{t(isPasswordUpdate ? 'Contraseña nueva' : 'Contraseña')}</span>
              <input
                autoComplete={isPasswordUpdate ? 'new-password' : 'current-password'}
                disabled={!configured || busy}
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
          )}
          {isPasswordUpdate && (
            <label className="auth-field">
              <span>{t('Repetir contraseña nueva')}</span>
              <input
                autoComplete="new-password"
                disabled={!configured || busy}
                minLength={6}
                onChange={(event) => setConfirmation(event.target.value)}
                required
                type="password"
                value={confirmation}
              />
            </label>
          )}
          {error && <p className="auth-error" role="alert">{t(error)}</p>}
          {notice && <p className="auth-message" role="status">{t(notice)}</p>}
          <button className="auth-button" disabled={!configured || busy} type="submit">
            {busy
              ? t('Procesando…')
              : isRecovery
                ? t('Enviar instrucciones')
                : isPasswordUpdate
                  ? t('Actualizar contraseña')
                  : t('Entrar')}
          </button>
        </form>

        {!isPasswordUpdate && (
          <button
            className="auth-link"
            disabled={busy}
            onClick={() => {
              setMode(isRecovery ? 'sign-in' : 'recovery')
              setError(undefined)
              setNotice(undefined)
            }}
            type="button"
          >
            {isRecovery ? t('Volver al inicio de sesión') : t('¿Olvidaste tu contraseña?')}
          </button>
        )}
        {!isRecovery && !isPasswordUpdate && (
          <>
            <p className="auth-card__footnote">
              {t('Las cuentas son creadas por la administración. No hay registro público.')}
            </p>
            {import.meta.env.VITE_ACCESS_REQUEST_EMAIL?.trim() ? (
              <a
                className="auth-link"
                href={`mailto:${encodeURIComponent(import.meta.env.VITE_ACCESS_REQUEST_EMAIL.trim()).replace(/%40/gi, '@')}?subject=${encodeURIComponent(t('Solicitud de acceso a Atenciones'))}`}
              >
                {t('Solicitar acceso')}
              </a>
            ) : (
              <>
                <button
                  className="auth-link"
                  onClick={() => setAccessRequestNotice(true)}
                  type="button"
                >
                  {t('Solicitar acceso')}
                </button>
                {accessRequestNotice && (
                  <p className="auth-card__footnote">
                    {t('Pide a la persona administradora del espacio que te envíe una invitación a este correo.')}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </section>
    </div>
  )
}
