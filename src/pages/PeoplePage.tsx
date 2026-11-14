import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, Mail, Pencil, Phone, Search, Trash2, UsersRound, X } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { useWorkspace } from '../auth/useWorkspace'
import { HistoryList } from '../components/HistoryList'
import { SectionTitle } from '../components/SectionTitle'
import { deleteSharedPerson, getAllSharedPeople, updateSharedPerson } from '../services/personService'
import { PROCESS_OPTIONS, type Person, type PersonWithHistory } from '../types/records'

const blankPerson: Person = { name: '', nationality: '', phone: '', email: '' }

export function PeoplePage() {
  const [people, setPeople] = useState<PersonWithHistory[]>([])
  const [loadResult, setLoadResult] = useState<{
    workspaceId: string
    refreshVersion: number
    error?: string
  }>()
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [query, setQuery] = useState('')
  const [nationality, setNationality] = useState('')
  const [process, setProcess] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [historyPerson, setHistoryPerson] = useState<PersonWithHistory | null>(null)
  const [editing, setEditing] = useState<Person>(blankPerson)
  const [formError, setFormError] = useState('')
  const { user } = useAuth()
  const { access } = useWorkspace()
  const workspaceId = access.status === 'active' ? access.membership.workspace_id : undefined
  const isAdmin = access.status === 'active' && access.membership.role === 'admin'

  useEffect(() => {
    if (!workspaceId) return
    let active = true
    void getAllSharedPeople(workspaceId).then(
      (result) => {
        if (active) {
          setPeople(result)
          setLoadResult({ workspaceId, refreshVersion })
        }
      },
      (caught: unknown) => {
        if (active) {
          setLoadResult({
            workspaceId,
            refreshVersion,
            error: caught instanceof Error ? caught.message : 'No se pudieron cargar las personas.',
          })
        }
      },
    )
    return () => {
      active = false
    }
  }, [workspaceId, refreshVersion])
  const loaded = loadResult?.workspaceId === workspaceId &&
    loadResult?.refreshVersion === refreshVersion
  const loading = Boolean(workspaceId) && !loaded
  const loadError = loaded ? loadResult?.error ?? '' : ''

  const nationalities = useMemo(
    () => [...new Set(people.map(({ nationality: value }) => value).filter(Boolean))].sort(),
    [people],
  )
  const filteredPeople = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    return people.filter((person) => {
      const textMatches = !term || [person.name, person.phone, person.email]
        .some((value) => value.toLocaleLowerCase().includes(term))
      const nationalityMatches = !nationality || person.nationality === nationality
      const attendanceMatches = person.appointments.some(({ date, process: itemProcess }) =>
        (!process || itemProcess === process) &&
        (!startDate || date >= startDate) &&
        (!endDate || date <= endDate),
      )
      const hasAttendanceFilter = Boolean(process || startDate || endDate)
      return textMatches && nationalityMatches && (!hasAttendanceFilter || attendanceMatches)
    })
  }, [people, query, nationality, process, startDate, endDate])

  async function saveEditedPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    try {
      if (!workspaceId || !user) throw new Error('No hay una sesión activa en el espacio de trabajo.')
      await updateSharedPerson(workspaceId, user.id, editing)
      setEditing(blankPerson)
      setRefreshVersion((version) => version + 1)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudieron guardar los cambios.')
    }
  }

  async function removePerson(person: PersonWithHistory) {
    if (!isAdmin || typeof person.id !== 'string' || !window.confirm(`¿Eliminar a ${person.name} y todas sus atenciones? Esta acción no se puede deshacer.`)) return
    try {
      if (!workspaceId) throw new Error('No hay un espacio de trabajo activo.')
      await deleteSharedPerson(workspaceId, person.id)
      setRefreshVersion((version) => version + 1)
      if (historyPerson?.id === person.id) setHistoryPerson(null)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo eliminar la persona.')
    }
  }

  return (
    <div className="page-stack">
      <SectionTitle eyebrow="DIRECTORIO" title="Personas registradas" description={`${people.length} ${people.length === 1 ? 'persona guardada' : 'personas guardadas'} en el espacio compartido.`} />
      {loadError && <p className="form-message form-message--error" role="alert">{loadError}</p>}
      <div className="filter-panel surface-card">
        <label className="search-box search-box--compact"><Search size={18} /><input onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, teléfono o correo" value={query} /></label>
        <label className="field field--filter"><span>Nacionalidad</span><select onChange={(event) => setNationality(event.target.value)} value={nationality}><option value="">Todas</option>{nationalities.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="field field--filter"><span>Proceso</span><select onChange={(event) => setProcess(event.target.value)} value={process}><option value="">Todos</option>{PROCESS_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="field field--filter"><span>Desde</span><input onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} /></label>
        <label className="field field--filter"><span>Hasta</span><input onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} /></label>
      </div>
      <div className="result-caption"><span>{filteredPeople.length} resultados</span><button className="text-button" onClick={() => { setQuery(''); setNationality(''); setProcess(''); setStartDate(''); setEndDate('') }} type="button">Limpiar filtros</button></div>
      <div className="surface-card table-card">
        {loading ? <div className="empty-state"><strong>Cargando personas del espacio compartido…</strong></div> : filteredPeople.length ? (
          <div className="table-scroll">
            <table className="people-table">
              <thead><tr><th>Persona</th><th>Contacto</th><th>Última atención</th><th>Atenciones</th><th>Acciones</th></tr></thead>
              <tbody>
                {filteredPeople.map((person) => (
                  <tr key={person.id}>
                    <td><div className="table-person"><span className="avatar avatar--small">{person.name.slice(0, 1).toLocaleUpperCase()}</span><span><strong>{person.name}</strong><small>{person.nationality}</small></span></div></td>
                    <td><span className="contact-lines">{person.phone && <span><Phone size={13} />{person.phone}</span>}{person.email && <span><Mail size={13} />{person.email}</span>}</span></td>
                    <td>{person.lastAppointment ? <span className="date-cell"><CalendarDays size={14} />{new Date(`${person.lastAppointment.date}T12:00:00`).toLocaleDateString('es')}</span> : '—'}</td>
                    <td><span className="count-badge">{person.appointments.length}</span></td>
                    <td><div className="table-actions"><button aria-label={`Ver historial de ${person.name}`} className="icon-button" onClick={() => setHistoryPerson(person)} title="Ver historial" type="button"><CalendarDays size={17} /></button>{(isAdmin || person.createdBy === user?.id) && <button aria-label={`Editar ${person.name}`} className="icon-button" onClick={() => { setEditing({ id: person.id, name: person.name, nationality: person.nationality, phone: person.phone, email: person.email }); setFormError('') }} title="Editar" type="button"><Pencil size={16} /></button>}{isAdmin && <button aria-label={`Eliminar ${person.name}`} className="icon-button icon-button--danger" onClick={() => void removePerson(person)} title="Eliminar" type="button"><Trash2 size={16} /></button>}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty-state"><span className="empty-state__icon"><UsersRound size={22} /></span><strong>No hay resultados para estos filtros</strong><p>Prueba a cambiar los criterios de búsqueda.</p></div>}
      </div>
      {historyPerson && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistoryPerson(null) }} role="presentation">
          <section aria-labelledby="history-title" aria-modal="true" className="modal-card" role="dialog">
            <div className="modal-heading"><div><p className="eyebrow">HISTORIAL COMPLETO</p><h2 id="history-title">{historyPerson.name}</h2><p>{historyPerson.nationality} · {historyPerson.appointments.length} atenciones</p></div><button aria-label="Cerrar historial" className="icon-button" onClick={() => setHistoryPerson(null)} type="button"><X size={18} /></button></div>
            <HistoryList appointments={historyPerson.appointments} />
          </section>
        </div>
      )}
      {editing.id && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(blankPerson) }} role="presentation">
          <form className="modal-card edit-form" onSubmit={saveEditedPerson}>
            <div className="modal-heading"><div><p className="eyebrow">DATOS PERSONALES</p><h2>Editar persona</h2></div><button aria-label="Cerrar edición" className="icon-button" onClick={() => setEditing(blankPerson)} type="button"><X size={18} /></button></div>
            <label className="field"><span>Nombre completo *</span><input maxLength={120} onChange={(event) => setEditing({ ...editing, name: event.target.value })} required value={editing.name} /></label>
            <label className="field"><span>Nacionalidad *</span><input maxLength={80} onChange={(event) => setEditing({ ...editing, nationality: event.target.value })} required value={editing.nationality} /></label>
            <label className="field"><span>Teléfono</span><input maxLength={40} onChange={(event) => setEditing({ ...editing, phone: event.target.value })} type="tel" value={editing.phone} /></label>
            <label className="field"><span>Correo electrónico</span><input maxLength={160} onChange={(event) => setEditing({ ...editing, email: event.target.value })} type="email" value={editing.email} /></label>
            {formError && <p className="form-message form-message--error" role="alert">{formError}</p>}
            <div className="form-actions"><button className="button button--primary" type="submit">Guardar cambios</button><button className="button button--ghost" onClick={() => setEditing(blankPerson)} type="button">Cancelar</button></div>
          </form>
        </div>
      )}
    </div>
  )
}
