import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Mail, Pencil, Phone, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { useWorkspace } from '../auth/useWorkspace'
import { useAttendanceData } from '../hooks/useAttendanceData'
import { getLocale, useI18n } from '../i18n'
import { formatDate } from '../lib/dates'
import { deleteSharedPerson, updateSharedPerson } from '../services/personService'
import type { Person, PersonWithHistory } from '../types/records'
import { capitalizeWords } from '../utils/textFormatting'
import { HistoryList } from './HistoryList'

interface PersonDrawerProps {
  personId: string
  onClose: () => void
  onRegister: (person: PersonWithHistory) => void
}

/** Ficha de una persona: contacto, historial completo y acciones. */
export function PersonDrawer({ personId, onClose, onRegister }: PersonDrawerProps) {
  const { language, t } = useI18n()
  const locale = getLocale(language)
  const { user } = useAuth()
  const { access } = useWorkspace()
  const { peopleById, refresh } = useAttendanceData()
  const person = peopleById.get(personId)
  const [editing, setEditing] = useState<Person | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const closeButton = useRef<HTMLButtonElement>(null)

  const workspaceId = access.status === 'active' ? access.membership.workspace_id : undefined
  const isAdmin = access.status === 'active' && access.membership.role === 'admin'
  const canEdit = Boolean(person && (isAdmin || person.createdBy === user?.id))

  useEffect(() => {
    closeButton.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!person) return null

  const first = person.appointments[person.appointments.length - 1]
  const last = person.appointments[0]

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing || !workspaceId || !user) return
    setBusy(true)
    setError('')
    try {
      await updateSharedPerson(workspaceId, user.id, editing)
      setEditing(null)
      refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron guardar los cambios.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!workspaceId || !person || typeof person.id !== 'string') return
    setBusy(true)
    setError('')
    try {
      await deleteSharedPerson(workspaceId, person.id)
      refresh()
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo eliminar la persona.')
      setBusy(false)
    }
  }

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }} role="presentation">
      <aside aria-labelledby="person-drawer-title" aria-modal="true" className="drawer" role="dialog">
        <div className="drawer__head">
          <span className="avatar avatar--large" aria-hidden="true">{person.name.slice(0, 1).toLocaleUpperCase()}</span>
          <div>
            <h2 id="person-drawer-title">{person.name}</h2>
            <p>{person.nationality}</p>
          </div>
          <button aria-label={t('Cerrar')} className="icon-button" onClick={onClose} ref={closeButton} type="button"><X size={18} /></button>
        </div>

        {editing ? (
          <form className="drawer__section form-stack" onSubmit={(event) => void save(event)}>
            <h3>{t('Editar datos')}</h3>
            <label className="field"><span>{t('Nombre completo')}</span><input autoCapitalize="words" maxLength={120} onChange={(event) => setEditing({ ...editing, name: capitalizeWords(event.target.value) })} required value={editing.name} /></label>
            <label className="field"><span>{t('Nacionalidad')}</span><input autoCapitalize="words" maxLength={80} onChange={(event) => setEditing({ ...editing, nationality: capitalizeWords(event.target.value) })} required value={editing.nationality} /></label>
            <label className="field"><span>{t('Teléfono')}</span><input maxLength={40} onChange={(event) => setEditing({ ...editing, phone: event.target.value })} type="tel" value={editing.phone} /></label>
            <label className="field"><span>{t('Correo electrónico')}</span><input maxLength={160} onChange={(event) => setEditing({ ...editing, email: event.target.value })} type="email" value={editing.email} /></label>
            {error && <p className="message message--error" role="alert">{t(error)}</p>}
            <div className="button-row">
              <button className="button button--primary" disabled={busy} type="submit">{busy ? t('Guardando…') : t('Guardar cambios')}</button>
              <button className="button button--quiet" disabled={busy} onClick={() => { setEditing(null); setError('') }} type="button">{t('Cancelar')}</button>
            </div>
          </form>
        ) : (
          <>
            <div className="drawer__section">
              <button className="button button--primary button--block" onClick={() => onRegister(person)} type="button">
                <Plus size={17} aria-hidden="true" />{t('Registrar atención')}
              </button>
              <dl className="facts">
                <div><dt>{t('Teléfono')}</dt><dd>{person.phone ? <a href={`tel:${person.phone.replace(/[^\d+]/g, '')}`}><Phone size={14} aria-hidden="true" />{person.phone}</a> : '—'}</dd></div>
                <div><dt>{t('Correo')}</dt><dd>{person.email ? <a href={`mailto:${person.email}`}><Mail size={14} aria-hidden="true" />{person.email}</a> : '—'}</dd></div>
                <div><dt>{t('Atenciones')}</dt><dd>{person.appointments.length}</dd></div>
                <div><dt>{t('Primera visita')}</dt><dd>{first ? formatDate(first.date, locale) : '—'}</dd></div>
                <div><dt>{t('Última visita')}</dt><dd>{last ? formatDate(last.date, locale) : '—'}</dd></div>
              </dl>
            </div>
            <div className="drawer__section">
              <h3>{t('Historial')}</h3>
              <HistoryList appointments={person.appointments} />
            </div>
            {(canEdit || isAdmin) && (
              <div className="drawer__section drawer__footer">
                {error && <p className="message message--error" role="alert">{t(error)}</p>}
                {confirmDelete ? (
                  <div className="confirm">
                    <p>{t('¿Eliminar a {name} y sus {count} atenciones? No se puede deshacer.', { name: person.name, count: person.appointments.length })}</p>
                    <div className="button-row">
                      <button className="button button--danger" disabled={busy} onClick={() => void remove()} type="button">{busy ? t('Eliminando…') : t('Eliminar definitivamente')}</button>
                      <button className="button button--quiet" disabled={busy} onClick={() => setConfirmDelete(false)} type="button">{t('Cancelar')}</button>
                    </div>
                  </div>
                ) : (
                  <div className="button-row">
                    {canEdit && (
                      <button className="button button--secondary" onClick={() => { setEditing({ id: person.id, name: person.name, nationality: person.nationality, phone: person.phone, email: person.email }); setError('') }} type="button">
                        <Pencil size={15} aria-hidden="true" />{t('Editar datos')}
                      </button>
                    )}
                    {isAdmin && (
                      <button className="button button--quiet button--danger-text" onClick={() => setConfirmDelete(true)} type="button">
                        <Trash2 size={15} aria-hidden="true" />{t('Eliminar')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  )
}
