import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Database, Eye, EyeOff, ShieldCheck, Trash2, UserPlus, UsersRound, X } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { useWorkspace } from '../auth/useWorkspace'
import { SectionTitle } from '../components/SectionTitle'
import { useAttendanceData } from '../hooks/useAttendanceData'
import { useI18n } from '../i18n'
import {
  createWorkspaceUser,
  listWorkspaceUsers,
  removeWorkspaceMember,
  updateWorkspaceMember,
  type WorkspaceUser,
} from '../services/userService'
import { SHARED_WORKSPACE_ID } from '../constants/workspace'
import { capitalizeWords } from '../utils/textFormatting'

export function SettingsPage() {
  const { t } = useI18n()
  const { people, appointments, loading, error } = useAttendanceData()
  const { access } = useWorkspace()
  const { user } = useAuth()
  const isAdmin = access.status === 'active' && access.membership.role === 'admin'
  const [members, setMembers] = useState<WorkspaceUser[]>([])
  const [membersLoaded, setMembersLoaded] = useState(false)
  const [membersError, setMembersError] = useState('')
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberPassword, setNewMemberPassword] = useState('')
  const [newMemberRole, setNewMemberRole] = useState<WorkspaceUser['role']>('attendant')
  const [showNewMemberPassword, setShowNewMemberPassword] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [createNotice, setCreateNotice] = useState('')
  const [memberNotice, setMemberNotice] = useState('')
  const [updatingMemberId, setUpdatingMemberId] = useState<string>()
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceUser | null>(null)

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

  async function handleCreateMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateBusy(true)
    setCreateNotice('')
    setMembersError('')
    try {
      await createWorkspaceUser(
        newMemberName,
        newMemberEmail,
        newMemberPassword,
        newMemberRole,
      )
      setNewMemberName('')
      setNewMemberEmail('')
      setNewMemberPassword('')
      setNewMemberRole('attendant')
      setShowNewMemberPassword(false)
      setCreateNotice('Cuenta creada y activa. Comparte las credenciales con la persona por un canal seguro.')
      await refreshMembers()
    } catch (createError: unknown) {
      setMembersError(
        createError instanceof Error
          ? createError.message
          : 'No se pudo crear la cuenta.',
      )
    } finally {
      setCreateBusy(false)
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

  async function removeMember() {
    const member = memberToRemove
    if (!member) return
    setUpdatingMemberId(member.id)
    setMembersError('')
    setMemberNotice('')
    try {
      await removeWorkspaceMember(SHARED_WORKSPACE_ID, member.id)
      setMembers((currentMembers) =>
        currentMembers.filter(({ id }) => id !== member.id),
      )
      setMemberToRemove(null)
      setMemberNotice('Se quitó el acceso del espacio. Sus registros históricos se conservaron.')
    } catch (removeError: unknown) {
      setMembersError(
        removeError instanceof Error
          ? removeError.message
          : 'No se pudo quitar el colaborador.',
      )
    } finally {
      setUpdatingMemberId(undefined)
    }
  }

  const removingMember = memberToRemove !== null &&
    updatingMemberId === memberToRemove.id

  return (
    <div className="page-stack page-stack--narrow">
      <SectionTitle
        eyebrow={t('ESPACIO DE TRABAJO')}
        title={t('Configuración')}
        description={t('Consulta el equipo y administra el acceso al espacio compartido.')}
      />
      {error && <p className="form-message form-message--error" role="alert">{t(error)}</p>}
      <section className="surface-card storage-summary">
        <span className="storage-summary__icon"><Database size={22} /></span>
        <div>
          <h2>{t('Base compartida')}</h2>
          <p>{t('Los registros se consultan desde el espacio de trabajo Supabase.')}</p>
        </div>
        <div className="storage-summary__counts">
          <span><strong>{loading ? '…' : people.length}</strong> {t('Personas')}</span>
          <span><strong>{loading ? '…' : appointments.length}</strong> {t('Atenciones')}</span>
        </div>
      </section>
      <section className="surface-card settings-card">
        <span className="settings-card__icon settings-card__icon--green"><ShieldCheck size={20} /></span>
        <div className="settings-card__body">
          <h2>{t('Acceso protegido')}</h2>
          <p>{t('Los miembros activos pueden consultar el espacio. Cada colaborador edita sus propios registros; solo la administración puede cambiar permisos o eliminar registros.')}</p>
        </div>
      </section>

      {isAdmin && (
        <section className="surface-card administration-card">
          <div className="administration-heading">
            <span className="storage-summary__icon"><UsersRound size={21} /></span>
            <div>
              <p className="eyebrow">{t('ADMINISTRACIÓN')}</p>
              <h2>{t('Miembros del espacio')}</h2>
              <p>{t('Crea cuentas con su rol y contraseña, y administra su acceso sin borrar sus registros.')}</p>
            </div>
          </div>

          <form className="member-create-form" onSubmit={(event) => void handleCreateMember(event)}>
            <label className="field">
              <span>{t('Nombre y apellido')}</span>
              <input
                autoComplete="name"
                disabled={createBusy}
                onChange={(event) => setNewMemberName(capitalizeWords(event.target.value))}
                autoCapitalize="words"
                maxLength={120}
                placeholder={t('Nombre del colaborador')}
                required
                type="text"
                value={newMemberName}
              />
            </label>
            <label className="field">
              <span>{t('Correo electrónico')}</span>
              <input
                autoComplete="email"
                disabled={createBusy}
                onChange={(event) => setNewMemberEmail(event.target.value)}
                placeholder={t('nombre@ejemplo.com')}
                required
                type="email"
                value={newMemberEmail}
              />
            </label>
            <label className="field">
              <span>{t('Contraseña inicial')}</span>
              <span className="member-create-form__password">
                <input
                  autoComplete="new-password"
                  disabled={createBusy}
                  minLength={6}
                  onChange={(event) => setNewMemberPassword(event.target.value)}
                  required
                  type={showNewMemberPassword ? 'text' : 'password'}
                  value={newMemberPassword}
                />
                <button
                  aria-label={t(showNewMemberPassword ? 'Ocultar contraseña' : 'Mostrar contraseña')}
                  className="member-create-form__password-toggle"
                  disabled={createBusy}
                  onClick={() => setShowNewMemberPassword((visible) => !visible)}
                  type="button"
                >
                  {showNewMemberPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
            <label className="field">
              <span>{t('Rol')}</span>
              <select
                disabled={createBusy}
                onChange={(event) => setNewMemberRole(event.target.value === 'admin' ? 'admin' : 'attendant')}
                value={newMemberRole}
              >
                <option value="attendant">{t('Colaborador')}</option>
                <option value="admin">{t('Administrador')}</option>
              </select>
            </label>
            <button className="button button--primary" disabled={createBusy} type="submit">
              <UserPlus size={16} />
              {createBusy ? t('Creando cuenta…') : t('Crear cuenta')}
            </button>
          </form>

          <p className="settings-note">
            {t('Supabase Auth protege la contraseña; no se muestra después ni se guarda en la lista de miembros. El acceso funciona con correo y contraseña, sin invitación por correo.')}
          </p>
          {createNotice && <p className="form-message form-message--success" role="status">{t(createNotice)}</p>}
          {membersError && !memberToRemove && <p className="form-message form-message--error" role="alert">{t(membersError)}</p>}

          <div className="table-scroll member-list">
            <table>
              <thead>
                <tr>
                  <th>{t('Persona')}</th>
                  <th>{t('Estado')}</th>
                  <th>{t('Rol')}</th>
                  <th>{t('Acceso')}</th>
                </tr>
              </thead>
              <tbody>
                {membersLoading ? (
                  <tr><td className="table-empty" colSpan={4}>{t('Cargando miembros…')}</td></tr>
                ) : members.length === 0 ? (
                  <tr><td className="table-empty" colSpan={4}>{t('Todavía no hay miembros para mostrar.')}</td></tr>
                ) : members.map((member) => {
                  const isSelf = member.user_id === user?.id
                  const protectedMember = member.is_owner || isSelf
                  const memberName = member.email ?? member.full_name
                  const status = !member.invitation_accepted_at
                    ? t('Invitación pendiente')
                    : member.is_active
                      ? t('Activa')
                      : t('Desactivada')

                  return (
                    <tr key={member.id}>
                      <td>
                        <span className="member-identity">
                          <strong>{member.full_name}</strong>
                          <small>{member.email ?? t('Correo no disponible')}</small>
                          {member.is_owner && <small className="member-owner">{t('Propietario del espacio')}</small>}
                        </span>
                      </td>
                      <td>
                        <span className={`member-status${member.is_active ? ' member-status--active' : ''}`}>
                          {status}
                        </span>
                      </td>
                      <td>
                        <select
                          aria-label={t('Rol de {name}', { name: member.email ?? member.full_name })}
                          disabled={protectedMember || updatingMemberId === member.id}
                          onChange={(event) => {
                            const role = event.target.value === 'admin' ? 'admin' : 'attendant'
                            void changeMember(member, { role })
                          }}
                          value={member.role}
                        >
                          <option value="attendant">{t('Colaborador')}</option>
                          <option value="admin">{t('Administrador')}</option>
                        </select>
                      </td>
                      <td>
                        {protectedMember ? (
                          <span className="member-protected">{t(member.is_owner ? 'Siempre activo' : 'Tu cuenta')}</span>
                        ) : (
                          <div className="table-actions">
                            {!member.invitation_accepted_at ? (
                              <span className="member-protected">{t('Esperando aceptación')}</span>
                            ) : (
                              <button
                                className={`button button--small ${member.is_active ? 'button--secondary' : 'button--primary'}`}
                                disabled={updatingMemberId === member.id}
                                onClick={() => void changeMember(member, { is_active: !member.is_active })}
                                type="button"
                              >
                                {updatingMemberId === member.id
                                  ? t('Guardando…')
                                  : member.is_active
                                    ? t('Desactivar')
                                    : t('Reactivar')}
                              </button>
                            )}
                            <button
                              aria-label={t('Quitar a {name} del espacio', { name: memberName })}
                              className="icon-button icon-button--danger"
                              disabled={updatingMemberId === member.id}
                              onClick={() => {
                                setMembersError('')
                                setMemberNotice('')
                                setMemberToRemove(member)
                              }}
                              title={t('Quitar colaborador')}
                              type="button"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {memberNotice && <p className="form-message form-message--success" role="status">{t(memberNotice)}</p>}
        </section>
      )}
      {memberToRemove && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !removingMember) {
              setMemberToRemove(null)
            }
          }}
          role="presentation"
        >
          <section
            aria-describedby="remove-member-description"
            aria-labelledby="remove-member-title"
            aria-modal="true"
            className="modal-card"
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !removingMember) {
                setMemberToRemove(null)
              }
            }}
            role="alertdialog"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">{t('ADMINISTRACIÓN')}</p>
                <h2 id="remove-member-title">{t('Quitar colaborador')}</h2>
                <p id="remove-member-description">
                  {t(
                    '¿Quitar a {name} del espacio? Perderá el acceso, pero sus registros históricos se conservarán.',
                    { name: memberToRemove.email ?? memberToRemove.full_name },
                  )}
                </p>
              </div>
              <button
                aria-label={t('Cerrar diálogo')}
                className="icon-button"
                disabled={removingMember}
                onClick={() => setMemberToRemove(null)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            {membersError && <p className="form-message form-message--error" role="alert">{t(membersError)}</p>}
            <div className="form-actions">
              <button
                autoFocus
                className="button button--secondary"
                disabled={removingMember}
                onClick={() => setMemberToRemove(null)}
                type="button"
              >
                {t('Cancelar')}
              </button>
              <button
                className="button button--danger"
                disabled={removingMember}
                onClick={() => void removeMember()}
                type="button"
              >
                <Trash2 size={16} />
                {removingMember ? t('Quitando…') : t('Quitar colaborador')}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
