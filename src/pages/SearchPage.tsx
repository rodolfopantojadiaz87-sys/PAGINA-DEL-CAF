import { useMemo, useState } from 'react'
import { CalendarDays, Mail, Phone, Search, UserRoundPlus, UsersRound } from 'lucide-react'
import { HistoryList } from '../components/HistoryList'
import { SectionTitle } from '../components/SectionTitle'
import { useAttendanceData } from '../hooks/useAttendanceData'
import { filterSharedPeople } from '../services/sharedData'
import type { Person } from '../types/records'
import { getLocale, useI18n } from '../i18n'

interface SearchPageProps {
  onSelectPerson: (person: Person) => void
}

export function SearchPage({ onSelectPerson }: SearchPageProps) {
  const [query, setQuery] = useState('')
  const { people: allPeople, loading, error } = useAttendanceData()
  const { language, t } = useI18n()
  const people = useMemo(() => filterSharedPeople(allPeople, query), [allPeople, query])

  return (
    <div className="page-stack">
      <SectionTitle
        eyebrow={t('PERSONAS')}
        title={t('Buscar personas')}
        description={t('Encuentra a alguien por nombre, teléfono o correo electrónico.')}
      />
      {error && <p className="form-message form-message--error" role="alert">{t(error)}</p>}
      <div className="search-box">
        <Search size={21} />
        <input autoComplete="off" onChange={(event) => setQuery(event.target.value)} placeholder={t('Escribe un nombre, teléfono o correo…')} value={query} />
        {query && <button aria-label={t('Limpiar búsqueda')} className="icon-button" onClick={() => setQuery('')} type="button">×</button>}
      </div>
      <div className="result-caption">
        <span>{loading ? t('Cargando datos compartidos…') : query ? t(people.length === 1 ? 'resultado' : 'resultados', { count: people.length }) : t('Personas registradas')}</span>
        <span>{t('Selecciona a la persona para ver su historial')}</span>
      </div>
      {loading ? (
        <div className="surface-card empty-state"><strong>{t('Consultando el espacio compartido…')}</strong></div>
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
                  <span><CalendarDays size={14} />{t('Última atención:')} {person.lastAppointment ? new Date(`${person.lastAppointment.date}T12:00:00`).toLocaleDateString(getLocale(language)) : t('Sin atenciones')}</span>
                </div>
                <button className="button button--primary button--small" onClick={() => onSelectPerson(person)} type="button"><UserRoundPlus size={16} />{t('Nueva atención')}</button>
              </div>
              <details className="history-details">
                <summary>{t('Historial completo')} <span>{person.appointments.length} {t(person.appointments.length === 1 ? 'atención' : 'atenciones')}</span></summary>
                <HistoryList appointments={person.appointments} />
              </details>
            </article>
          ))}
        </div>
      ) : (
        <div className="surface-card empty-state empty-state--large">
          <span className="empty-state__icon"><UsersRound size={23} /></span>
          <strong>{query ? t('No encontramos coincidencias') : t('Todavía no hay personas')}</strong>
          <p>{query ? t('Prueba con otro nombre, número de teléfono o correo.') : t('Las personas aparecerán aquí después de guardar su primera atención.')}</p>
        </div>
      )}
    </div>
  )
}
