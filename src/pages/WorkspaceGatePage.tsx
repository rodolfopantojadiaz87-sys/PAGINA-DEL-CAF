import { useState } from 'react'
import { Building2, ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { useWorkspace } from '../auth/useWorkspace'
import { signOut } from '../services/authService'

export function WorkspaceGatePage() {
  const { user } = useAuth()
  const { access, refresh } = useWorkspace()
  const [busy, setBusy] = useState(false)
  const [signOutError, setSignOutError] = useState<string>()

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

  const authorized = access.status === 'active'
  const role =
    access.status === 'active'
      ? access.membership.role === 'admin'
        ? 'Administrador'
        : 'Colaborador'
      : undefined

  return (
    <div className="auth-page">
      <section className="auth-card auth-card--notice">
        <span className="auth-card__icon">
          {authorized ? <ShieldCheck size={26} /> : <Building2 size={26} />}
        </span>
        <p className="auth-card__eyebrow">ESPACIO DE TRABAJO COMPARTIDO</p>
        <h1>
          {authorized
            ? 'Membresía verificada'
            : access.status === 'error'
              ? 'No se pudo verificar el acceso'
              : 'Sin acceso al espacio'}
        </h1>
        {user?.email && <p>Cuenta: <strong>{user.email}</strong></p>}

        {authorized && (
          <div className="auth-message" role="status">
            Rol autorizado: <strong>{role}</strong>. Los registros compartidos
            todavía no están conectados a la aplicación. Los datos locales
            permanecen ocultos hasta completar esa integración.
          </div>
        )}
        {access.status === 'denied' && (
          <div className="auth-message auth-message--warning" role="alert">
            Esta cuenta no tiene una membresía activa en el espacio CAF. Pide
            al administrador que la invite o reactive.
          </div>
        )}
        {access.status === 'error' && (
          <div className="auth-message auth-message--warning" role="alert">
            {access.message}
          </div>
        )}

        {signOutError && <p className="auth-error" role="alert">{signOutError}</p>}
        <div className="workspace-gate__actions">
          {(access.status === 'denied' || access.status === 'error') && (
            <button className="auth-button auth-button--secondary" onClick={refresh} type="button">
              Volver a comprobar
            </button>
          )}
          <button className="auth-button" disabled={busy} onClick={() => void handleSignOut()} type="button">
            {busy ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </div>
      </section>
    </div>
  )
}
