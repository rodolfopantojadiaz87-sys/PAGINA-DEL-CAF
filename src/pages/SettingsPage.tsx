import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Eye, EyeOff, Trash2, UserPlus, X } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { useWorkspace } from '../auth/useWorkspace'
import { PageHeader } from '../components/PageHeader'
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

/** Miembros del espacio: alta con contraseña y rol, cambio de rol, desactivar y quitar. */
export function SettingsPage() {
  const { t } = useI18n()
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
  const [showPassword, setShowPassword] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState('')
  const [notice, setNotice] = useState('')
  const [updatingMemberId, setUpdatingMemberId] = useState<string>()
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceUser | null>(null)

  const loadMembers = useCallback(() => listWorkspaceUsers(SHARED_WORKSPACE_ID), [])

  useEffect(() => {
    if (!isAdmin) return
    let active = true
    loadMembers()
      .then((nextMembers) => {
        if (!active) return
        setMembers(nextMembers)
        setMembersError('')
      })
      .catch((loadError: unknown) => {
        if (active) setMembersError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el equipo.')
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
      setMembersError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el equipo.')
    }
  }

  async function handleCreateMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateBusy(true)
    setCreateError('')
    setNotice('')
    try {
      await createWorkspaceUser(newMemberName, newMemberEmail, newMemberPassword, newMemberRole)
      setNotice(t('{name} ya puede entrar con {email} y la contraseña que elegiste.', { name: newMemberName.trim(), email: newMemberEmail.trim() }))
      setNewMemberName('')
      setNewMemberEmail('')
      setNewMemberPassword('')
      setNewMemberRole('attendant')
      setShowPassword(false)
      await refreshMembers()
    } catch (caught: unknown) {
      setCreateError(caught instanceof Error ? caught.message : 'No se pudo crear el miembro.')
    } finally {
      setCreateBusy(false)
    }
  }

  async function changeMember(member: WorkspaceUser, changes: { role?: WorkspaceUser['role']; is_active?: boolean }) {
    setUpdatingMemberId(member.id)
    setMembersError('')
    setNotice('')
    try {
      await updateWorkspaceMember(SHARED_WORKSPACE_ID, member.id, {
        role: changes.role ?? member.role,
        is_active: changes.is_active ?? member.is_active,
      })
      await refreshMembers()
    } catch (caught: unknown) {
      setMembersError(caught instanceof Error ? caught.message : 'No se pudo actualizar el permiso.')
    } finally {
      setUpdatingMemberId(undefined)
    }
  }

  async function removeMember() {
    const member = memberToRemove
    if (!member) return
    setUpdatingMemberId(member.id)
    setMembersError('')
    try {
      await removeWorkspaceMember(SHARED_WORKSPACE_ID, member.id)
      setMembers((current) => current.filter(({ id }) => id !== member.id))
      setMemberToRemove(null)
      setNotice(t('{name} ya no tiene acceso. Sus registros se conservan.', { name: member.full_name }))
    } catch (caught: unknown) {
      setMembersError(caught instanceof Error ? caught.message : 'No se pudo quitar el colaborador.')
    } finally {
      setUpdatingMemberId(undefined)
    }
  }

  const removingMember = memberToRemove !== null && updatingMemberId === memberToRemove.id

  return (
    <div className="page">
      <PageHeader title={t('Miembros')} description={t('Quién puede entrar al sistema y qué puede hacer.')} />

      <div className="members-layout">
        <section className="panel" aria-labelledby="create-member-title">
          <div className="panel__head"><h2 id="create-member-title">{t('Crear miembro')}</h2></div>
          <form className="form-stack" onSubmit={(event) => void handleCreateMember(event)}>
            <label className="field">
              <span>{t('Nombre y apellido')}</span>
              <input autoCapitalize="words" autoComplete="off" disabled={createBusy} maxLength={120} onChange={(event) => setNewMemberName(capitalizeWords(event.target.value))} required type="text" value={newMemberName} />
            </label>
            <label className="field">
              <span>{t('Correo electrónico')}</span>
              <input autoComplete="off" disabled={createBusy} onChange={(event) => { setNewMemberEmail(event.target.value); setNotice('') }} placeholder={t('nombre@ejemplo.com')} required type="email" value={newMemberEmail} />
            </label>
            <label className="field">
              <span>{t('Contraseña')}</span>
              <span className="password-field">
                <input autoComplete="new-password" disabled={createBusy} minLength={6} onChange={(event) => setNewMemberPassword(event.target.value)} required type={showPassword ? 'text' : 'password'} value={newMemberPassword} />
                <button aria-label={t(showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña')} className="icon-button" disabled={createBusy} onClick={() => setShowPassword((visible) => !visible)} type="button">
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
              <small>{t('Mínimo 6 caracteres. Compártela con la persona por un canal seguro: no se vuelve a mostrar.')}</small>
            </label>
            <fieldset className="role-picker">
              <legend>{t('Rol')}</legend>
              <label className="role-option">
                <input checked={newMemberRole === 'attendant'} disabled={createBusy} name="role" onChange={() => setNewMemberRole('attendant')} type="radio" />
                <span><strong>{t('Colaborador')}</strong><small>{t('Registra atenciones y consulta personas e informes.')}</small></span>
              </label>
              <label className="role-option">
                <input checked={newMemberRole === 'admin'} disabled={createBusy} name="role" onChange={() => setNewMemberRole('admin')} type="radio" />
                <span><strong>{t('Administrador')}</strong><small>{t('Además edita cualquier dato, elimina personas y gestiona miembros.')}</small></span>
              </label>
            </fieldset>
            {createError && <p className="message message--error" role="alert">{t(createError)}</p>}
            <button className="button button--primary" disabled={createBusy} type="submit">
              <UserPlus size={16} aria-hidden="true" />{createBusy ? t('Creando miembro…') : t('Crear miembro')}
            </button>
          </form>
        </section>

        <section className="panel" aria-labelledby="members-title">
          <div className="panel__head">
            <h2 id="members-title">{t('Equipo')}</h2>
            <p>{membersLoaded ? t('{count} miembros', { count: members.length }) : t('Cargando…')}</p>
          </div>
          {notice && <p className="message message--success" role="status">{notice}</p>}
          {membersError && !memberToRemove && <p className="message message--error" role="alert">{t(membersError)}</p>}
          <ul className="member-list">
            {members.map((member) => {
              const isSelf = member.user_id === user?.id
              const protectedMember = member.is_owner || isSelf
              const busy = updatingMemberId === member.id
              return (
                <li className={member.is_active ? 'member' : 'member member--inactive'} key={member.id}>
                  <span className="avatar" aria-hidden="true">{member.full_name.slice(0, 1).toLocaleUpperCase()}</span>
                  <div className="member__identity">
                    <strong>{member.full_name}{isSelf && <em>{t('(tú)')}</em>}</strong>
                    <small>{member.email ?? t('Correo no disponible')}</small>
                    {!member.is_active && <span className="badge">{t('Desactivado')}</span>}
                    {member.is_owner && <span className="badge badge--owner">{t('Propietario')}</span>}
                  </div>
                  <div className="member__controls">
                    <select aria-label={t('Rol de {name}', { name: member.full_name })} disabled={protectedMember || busy} onChange={(event) => void changeMember(member, { role: event.target.value === 'admin' ? 'admin' : 'attendant' })} value={member.role}>
                      <option value="attendant">{t('Colaborador')}</option>
                      <option value="admin">{t('Administrador')}</option>
                    </select>
                    {!protectedMember && (
                      <>
                        <button className="button button--quiet button--small" disabled={busy} onClick={() => void changeMember(member, { is_active: !member.is_active })} type="button">
                          {busy ? t('Guardando…') : member.is_active ? t('Desactivar') : t('Reactivar')}
                        </button>
                        <button aria-label={t('Quitar a {name} del espacio', { name: member.full_name })} className="icon-button icon-button--danger" disabled={busy} onClick={() => { setMembersError(''); setMemberToRemove(member) }} title={t('Quitar del espacio')} type="button">
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      {memberToRemove && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !removingMember) setMemberToRemove(null) }} role="presentation">
          <section aria-describedby="remove-member-description" aria-labelledby="remove-member-title" aria-modal="true" className="modal" onKeyDown={(event) => { if (event.key === 'Escape' && !removingMember) setMemberToRemove(null) }} role="alertdialog">
            <div className="modal__head">
              <h2 id="remove-member-title">{t('Quitar del espacio')}</h2>
              <button aria-label={t('Cerrar')} className="icon-button" disabled={removingMember} onClick={() => setMemberToRemove(null)} type="button"><X size={18} /></button>
            </div>
            <p id="remove-member-description">
              {t('{name} dejará de tener acceso. Sus registros se conservan, y puedes volver a crearlo con el mismo correo más adelante.', { name: memberToRemove.full_name })}
            </p>
            {membersError && <p className="message message--error" role="alert">{t(membersError)}</p>}
            <div className="button-row">
              <button className="button button--danger" disabled={removingMember} onClick={() => void removeMember()} type="button">
                <Trash2 size={16} aria-hidden="true" />{removingMember ? t('Quitando…') : t('Quitar')}
              </button>
              <button autoFocus className="button button--quiet" disabled={removingMember} onClick={() => setMemberToRemove(null)} type="button">{t('Cancelar')}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
