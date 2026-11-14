import { useMemo, useState } from 'react'
import { CalendarDays, Mail, Phone, Search, UserRoundPlus, UsersRound } from 'lucide-react'
import { HistoryList } from '../components/HistoryList'
import { SectionTitle } from '../components/SectionTitle'
import { useAttendanceData } from '../hooks/useAttendanceData'
import { filterSharedPeople } from '../services/sharedData'
import type { Person } from '../types/records'

interface SearchPageProps {
  onSelectPerson: (person: Person) => void
}

export function SearchPage({ onSelectPerson }: SearchPageProps) {
  const [query, setQuery] = useState('')
  const { people: allPeople, loading, error } = useAttendanceData()
  const people = useMemo(() => filterSharedPeople(allPeople, query), [allPeople, query])

  return (
    <div className="page-stack">
      <SectionTitle
        eyebrow="PERSONAS"
        title="Buscar personas"
        description="Encuentra a alguien por nombre, teléfono o correo electrónico."
      />
      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      <div className="search-box">
        <Search size={21} />
        <input autoComplete="off" onChange={(event) => setQuery(event.target.value)} placeholder="Escribe un nombre, teléfono o correo…" value={query} />
        {query && <button aria-label="Limpiar búsqueda" className="icon-button" onClick={() => setQuery('')} type="button">×</button>}
      </div>
      <div className="result-caption">
        <span>{loading ? 'Cargando datos compartidos…' : query ? `${people.length} ${people.length === 1 ? 'resultado' : 'resultados'}` : 'Personas registradas'}</span>
        <span>Selecciona a la persona para ver su historial</span>
      </div>
      {loading ? (
        <div className="surface-card empty-state"><strong>Consultando el espacio compartido…</strong></div>
      ) : people.length ? (
        <div className="person-results">
          {people.map((person) => (
            <article className="surface-card person-result" key={person.id}>
              <div className="person-result__main">
                <span className="avatar">{person.name.slice(0, 1).toLocaleUpperCase()}</span>
                <div><h2>{person.name}</h2><span className="nationality-tag">{person.nationality}</span></div>
                <div className="person-result__details">
                  {person.phone && <span><Phone size={14} />{person.phone}</span>}
                  {person.email && <span><Mail size={14} />{person.email}</span>}
                  <span><CalendarDays size={14} />Última atención: {person.lastAppointment ? new Date(`${person.lastAppointment.date}T12:00:00`).toLocaleDateString('es') : 'Sin atenciones'}</span>
                </div>
                <button className="button button--primary button--small" onClick={() => onSelectPerson(person)} type="button"><UserRoundPlus size={16} />Nueva atención</button>
              </div>
              <details className="history-details">
                <summary>Historial completo <span>{person.appointments.length} {person.appointments.length === 1 ? 'atención' : 'atenciones'}</span></summary>
                <HistoryList appointments={person.appointments} />
              </details>
            </article>
          ))}
        </div>
      ) : (
        <div className="surface-card empty-state empty-state--large">
          <span className="empty-state__icon"><UsersRound size={23} /></span>
          <strong>{query ? 'No encontramos coincidencias' : 'Todavía no hay personas'}</strong>
          <p>{query ? 'Prueba con otro nombre, número de teléfono o correo.' : 'Las personas aparecerán aquí después de guardar su primera atención.'}</p>
        </div>
      )}
    </div>
  )
}
