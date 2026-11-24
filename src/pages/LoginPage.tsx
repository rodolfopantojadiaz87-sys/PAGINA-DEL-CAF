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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout } from '../components/AuthLayout'
import { FormAlert } from '../components/FormAlert'

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
    <AuthLayout
      description={isRecovery
        ? t('Te enviaremos un enlace al correo de tu cuenta para crear una contraseña nueva.')
        : isPasswordUpdate
          ? t('Elige una contraseña de al menos 6 caracteres.')
          : t('Entra con el correo y la contraseña que te dio la administración.')}
      title={title}
    >
      <div className="space-y-4">
        {!configured && (
          <FormAlert kind="warning">
            {t('Supabase todavía no está configurado. Define')} <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> {t('en un archivo')} <code>.env.local</code> {t('y reinicia Vite.')}
          </FormAlert>
        )}

        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          {!isPasswordUpdate && (
            <div className="grid gap-2">
              <Label htmlFor="auth-email">{t('Correo electrónico')}</Label>
              <Input autoComplete="email" disabled={!configured || busy} id="auth-email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
            </div>
          )}
          {!isRecovery && (
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="auth-password">{t(isPasswordUpdate ? 'Contraseña nueva' : 'Contraseña')}</Label>
                {!isPasswordUpdate && (
                  <Button className="h-auto px-0 text-xs" disabled={busy} onClick={() => { setMode('recovery'); setError(undefined); setNotice(undefined) }} type="button" variant="link">
                    {t('¿Olvidaste tu contraseña?')}
                  </Button>
                )}
              </div>
              <Input autoComplete={isPasswordUpdate ? 'new-password' : 'current-password'} disabled={!configured || busy} id="auth-password" minLength={6} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
            </div>
          )}
          {isPasswordUpdate && (
            <div className="grid gap-2">
              <Label htmlFor="auth-confirmation">{t('Repetir contraseña nueva')}</Label>
              <Input autoComplete="new-password" disabled={!configured || busy} id="auth-confirmation" minLength={6} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} />
            </div>
          )}
          {error && <FormAlert>{t(error)}</FormAlert>}
          {notice && <FormAlert kind="success">{t(notice)}</FormAlert>}
          <Button className="w-full" disabled={!configured || busy} type="submit">
            {busy
              ? t('Procesando…')
              : isRecovery
                ? t('Enviar enlace')
                : isPasswordUpdate
                  ? t('Guardar contraseña')
                  : t('Entrar')}
          </Button>
        </form>

        {isRecovery && (
          <Button className="w-full" disabled={busy} onClick={() => { setMode('sign-in'); setError(undefined); setNotice(undefined) }} variant="ghost">
            {t('Volver a iniciar sesión')}
          </Button>
        )}
        {isPasswordUpdate && (
          <Button className="w-full" disabled={busy} onClick={() => void handleSignOut()} variant="ghost">
            {t('Cancelar y volver al inicio de sesión')}
          </Button>
        )}
        {!isRecovery && !isPasswordUpdate && (
          <p className="text-center text-xs text-muted-foreground">
            {t('¿No tienes cuenta? La crea un administrador del centro.')}
            {accessEmail && (
              <>
                {' '}
                <a className="underline underline-offset-4 hover:text-foreground" href={`mailto:${encodeURIComponent(accessEmail).replace(/%40/gi, '@')}?subject=${encodeURIComponent(t('Solicitud de acceso a Atenciones'))}`}>{t('Pedir acceso por correo')}</a>
              </>
            )}
          </p>
        )}
      </div>
    </AuthLayout>
  )
}
