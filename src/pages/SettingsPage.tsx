import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Database, MailPlus, ShieldCheck, UsersRound } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { useWorkspace } from '../auth/useWorkspace'
import { SectionTitle } from '../components/SectionTitle'
import { useAttendanceData } from '../hooks/useAttendanceData'
import {
  inviteWorkspaceUser,
  listWorkspaceUsers,
  updateWorkspaceMember,
  type WorkspaceUser,
} from '../services/userService'
import { SHARED_WORKSPACE_ID } from '../constants/workspace'

export function SettingsPage() {
  const { people, appointments, loading, error } = useAttendanceData()
  const { access } = useWorkspace()
  const { user } = useAuth()
  const isAdmin = access.status === 'active' && access.membership.role === 'admin'
  const [members, setMembers] = useState<WorkspaceUser[]>([])
  const [membersLoaded, setMembersLoaded] = useState(false)
  const [membersError, setMembersError] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteNotice, setInviteNotice] = useState('')
  const [updatingMemberId, setUpdatingMemberId] = useState<string>()

  const loadMembers = useCallback(
    () => listWorkspaceUsers(SHARED_WORKSPACE_ID),
    [],
  )

  const membersLoading = isAdmin && !membersLoaded

  useEffect(() => {
    if (!isAdmin) return

    let active = true
    void loadMembers()
      .then((nextMembers) => {
        if (!active) return
        setMembers(nextMembers)
        setMembersError('')
      })
      .catch((loadError: unknown) => {
        if (!active) return
        setMembersError(
          loadError instanceof Error
            ? loadError.message
            : 'No se pudo cargar el equipo.',
        )
      })
      .finally(() => {
        if (active) setMembersLoaded(true)
      })

    return () => {
      active = false
    }
  }, [isAdmin, loadMembers])

  async function refreshMembers() {
    try {
      setMembers(await loadMembers())
    } catch (loadError: unknown) {
      setMembersError(
        loadError instanceof Error
          ? loadError.message
          : 'No se pudo cargar el equipo.',
      )
    }
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setInviteBusy(true)
    setInviteNotice('')
    setMembersError('')
    try {
      await inviteWorkspaceUser(inviteEmail)
      setInviteEmail('')
      setInviteNotice('Invitación enviada. El colaborador recibirá un enlace para completar su perfil.')
      await refreshMembers()
    } catch (inviteError: unknown) {
      setMembersError(
        inviteError instanceof Error
          ? inviteError.message
          : 'No se pudo enviar la invitación.',
      )
    } finally {
      setInviteBusy(false)
    }
  }

  async function changeMember(
    member: WorkspaceUser,
    changes: { role?: WorkspaceUser['role']; is_active?: boolean },
  ) {
    setUpdatingMemberId(member.id)
    setMembersError('')
    try {
      await updateWorkspaceMember(SHARED_WORKSPACE_ID, member.id, {
        role: changes.role ?? member.role,
        is_active: changes.is_active ?? member.is_active,
      })
      await refreshMembers()
    } catch (updateError: unknown) {
      setMembersError(
        updateError instanceof Error
          ? updateError.message
          : 'No se pudo actualizar el permiso.',
      )
    } finally {
      setUpdatingMemberId(undefined)
    }
  }

  return (
    <div className="page-stack page-stack--narrow">
      <SectionTitle
        eyebrow="ESPACIO DE TRABAJO"
        title="Configuración"
        description="Consulta el equipo y administra el acceso al espacio compartido."
      />
      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      <section className="surface-card storage-summary">
        <span className="storage-summary__icon"><Database size={22} /></span>
        <div>
          <h2>Base compartida</h2>
          <p>Los registros se consultan desde el espacio de trabajo Supabase.</p>
        </div>
        <div className="storage-summary__counts">
          <span><strong>{loading ? '…' : people.length}</strong> personas</span>
          <span><strong>{loading ? '…' : appointments.length}</strong> atenciones</span>
        </div>
      </section>
      <section className="surface-card settings-card">
        <span className="settings-card__icon settings-card__icon--green"><ShieldCheck size={20} /></span>
        <div className="settings-card__body">
          <h2>Acceso protegido</h2>
          <p>Los miembros activos pueden consultar el espacio. Cada colaborador edita sus propios registros; solo la administración puede cambiar permisos o eliminar registros.</p>
        </div>
      </section>

      {isAdmin && (
        <section className="surface-card administration-card">
          <div className="administration-heading">
            <span className="storage-summary__icon"><UsersRound size={21} /></span>
            <div>
              <p className="eyebrow">ADMINISTRACIÓN</p>
              <h2>Miembros del espacio</h2>
              <p>Invita colaboradores, cambia su rol y desactiva o reactiva su acceso sin borrar sus registros.</p>
            </div>
          </div>

          <form className="member-invite-form" onSubmit={(event) => void handleInvite(event)}>
            <label className="field">
              <span>Correo del colaborador</span>
              <input
                autoComplete="email"
                disabled={inviteBusy}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="nombre@ejemplo.com"
                required
                type="email"
                value={inviteEmail}
              />
            </label>
            <button className="button button--primary" disabled={inviteBusy} type="submit">
              <MailPlus size={16} />
              {inviteBusy ? 'Enviando…' : 'Invitar colaborador'}
            </button>
          </form>

          {inviteNotice && <p className="form-message form-message--success" role="status">{inviteNotice}</p>}
          {membersError && <p className="form-message form-message--error" role="alert">{membersError}</p>}

          <div className="table-scroll member-list">
            <table>
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Estado</th>
                  <th>Rol</th>
                  <th>Acceso</th>
                </tr>
              </thead>
              <tbody>
                {membersLoading ? (
                  <tr><td className="table-empty" colSpan={4}>Cargando miembros…</td></tr>
                ) : members.length === 0 ? (
                  <tr><td className="table-empty" colSpan={4}>Todavía no hay miembros para mostrar.</td></tr>
                ) : members.map((member) => {
                  const isSelf = member.user_id === user?.id
                  const protectedMember = member.is_owner || isSelf
                  const status = !member.invitation_accepted_at
                    ? 'Invitación pendiente'
                    : member.is_active
                      ? 'Activa'
                      : 'Desactivada'

                  return (
                    <tr key={member.id}>
                      <td>
                        <span className="member-identity">
                          <strong>{member.full_name}</strong>
                          <small>{member.email ?? 'Correo no disponible'}</small>
                          {member.is_owner && <small className="member-owner">Propietario del espacio</small>}
                        </span>
                      </td>
                      <td>
                        <span className={`member-status${member.is_active ? ' member-status--active' : ''}`}>
                          {status}
                        </span>
                      </td>
                      <td>
                        <select
                          aria-label={`Rol de ${member.email ?? member.full_name}`}
                          disabled={protectedMember || updatingMemberId === member.id}
                          onChange={(event) => {
                            const role = event.target.value === 'admin' ? 'admin' : 'attendant'
                            void changeMember(member, { role })
                          }}
                          value={member.role}
                        >
                          <option value="attendant">Colaborador</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </td>
                      <td>
                        {protectedMember ? (
                          <span className="member-protected">{member.is_owner ? 'Siempre activo' : 'Tu cuenta'}</span>
                        ) : !member.invitation_accepted_at ? (
                          <span className="member-protected">Esperando aceptación</span>
                        ) : (
                          <button
                            className={`button button--small ${member.is_active ? 'button--secondary' : 'button--primary'}`}
                            disabled={updatingMemberId === member.id}
                            onClick={() => void changeMember(member, { is_active: !member.is_active })}
                            type="button"
                          >
                            {updatingMemberId === member.id
                              ? 'Guardando…'
                              : member.is_active
                                ? 'Desactivar'
                                : 'Reactivar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
