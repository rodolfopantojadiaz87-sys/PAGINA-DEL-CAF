import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { useWorkspace } from '../auth/useWorkspace'
import { signOut } from '../services/authService'
import { useI18n } from '../i18n'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '../components/AuthLayout'
import { FormAlert } from '../components/FormAlert'

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
    <AuthLayout
      description={connectionProblem
        ? t('Revisa tu conexión a internet e inténtalo de nuevo.')
        : t('Pide a un administrador que habilite tu cuenta. Cuando lo haga, pulsa el botón de abajo.')}
      title={connectionProblem ? t('No pudimos comprobar tu acceso') : t('Todavía no tienes acceso')}
    >
      <div className="space-y-4">
        {user?.email && <p className="text-sm text-muted-foreground">{t('Cuenta: {email}', { email: user.email })}</p>}
        {signOutError && <FormAlert>{t(signOutError)}</FormAlert>}
        <Button className="w-full" onClick={refresh}>
          {connectionProblem ? t('Reintentar') : t('Ya me dieron acceso')}
        </Button>
        <Button className="w-full" disabled={busy} onClick={() => void handleSignOut()} variant="ghost">
          {busy ? t('Cerrando sesión…') : t('Entrar con otra cuenta')}
        </Button>
      </div>
    </AuthLayout>
  )
}
