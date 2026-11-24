import { useMemo, useState } from 'react'
import { Plus, Search, UserPlus } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { ProcessTag } from '../components/ProcessTag'
import { useAttendanceData } from '../hooks/useAttendanceData'
import { getLocale, useI18n } from '../i18n'
import { formatDate, localDate, relativeDay } from '../lib/dates'
import { resolvePeriod } from '../lib/filters'
import { searchPeople } from '../lib/search'
import { summarizeAttendances } from '../statistics/aggregates'
import type { PersonWithHistory, Section } from '../types/records'
import type { RegistrationTarget } from '../App'

interface HomePageProps {
  onNavigate: (section: Section) => void
  onOpenPerson: (personId: string) => void
  onRegister: (target: RegistrationTarget) => void
}

/**
 * Recepción: la pantalla responde a lo que pasa en la ventanilla. Llega alguien,
 * se le busca y se registra su atención, o se crea si es la primera vez.
 */
export function HomePage({ onNavigate, onOpenPerson, onRegister }: HomePageProps) {
  const { language, t } = useI18n()
  const locale = getLocale(language)
  const { user } = useAuth()
  const { people, appointments, peopleById, loading, error } = useAttendanceData()
  const [query, setQuery] = useState('')
  const matches = useMemo(() => (query.trim().length >= 2 ? searchPeople(people, query).slice(0, 6) : []), [people, query])

  const today = localDate()
  const month = resolvePeriod({ period: 'this-month', from: '', to: '' })
  const monthAppointments = useMemo(
    () => appointments.filter(({ date }) => date >= month.from && date <= month.to),
    [appointments, month.from, month.to],
  )
  const monthSummary = useMemo(() => summarizeAttendances(monthAppointments, peopleById), [monthAppointments, peopleById])
  const todayCount = appointments.filter(({ date }) => date === today).length
  const recent = useMemo(
    () => [...appointments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
    [appointments],
  )
  const firstName = (typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '').split(' ')[0]

  function registerFor(person: PersonWithHistory) {
    onRegister({ person })
  }

  return (
    <div className="page page--home">
      <section className="reception" aria-labelledby="reception-title">
        <p className="reception__greeting">
          {firstName ? t('Hola, {name}', { name: firstName }) : t('Hola')}
          <span>{formatDate(today, locale, 'long')}</span>
        </p>
        <h1 id="reception-title">{t('¿A quién vas a atender?')}</h1>
        <label className="reception__search">
          <Search size={22} aria-hidden="true" />
          <span className="visually-hidden">{t('Buscar persona')}</span>
          <input
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && matches.length === 1) registerFor(matches[0])
            }}
            placeholder={t('Nombre, teléfono o correo')}
            type="search"
            value={query}
          />
        </label>

        {query.trim().length >= 2 && (
          <div className="reception__results" aria-live="polite">
            {matches.length > 0 && (
              <ul className="match-list">
                {matches.map((person) => (
                  <li key={person.id}>
                    <button className="match-list__person" onClick={() => onOpenPerson(String(person.id))} type="button">
                      <span className="avatar" aria-hidden="true">{person.name.slice(0, 1).toLocaleUpperCase()}</span>
                      <span>
                        <strong>{person.name}</strong>
                        <small>
                          {person.nationality}
                          {person.lastAppointment
                            ? `, ${t('última visita {date}', { date: relativeDay(person.lastAppointment.date, locale, t) })}`
                            : ''}
                        </small>
                      </span>
                    </button>
                    <button className="button button--primary button--small" onClick={() => registerFor(person)} type="button">
                      <Plus size={15} aria-hidden="true" />{t('Registrar atención')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button className="new-person" onClick={() => onRegister({ name: query.trim() })} type="button">
              <UserPlus size={18} aria-hidden="true" />
              <span>
                {matches.length ? t('¿No es ninguna de estas personas?') : t('No hay nadie registrado con ese nombre.')}
                <strong>{t('Registrar a «{name}» como persona nueva', { name: query.trim() })}</strong>
              </span>
            </button>
          </div>
        )}
      </section>

      {error && <p className="message message--error" role="alert">{t(error)}</p>}

      <section className="today" aria-label={t('Actividad')}>
        <div className="figure">
          <strong>{loading ? '…' : todayCount}</strong>
          <span>{t(todayCount === 1 ? 'atención hoy' : 'atenciones hoy')}</span>
        </div>
        <div className="figure">
          <strong>{loading ? '…' : monthSummary.appointmentCount}</strong>
          <span>{t('atenciones este mes')}</span>
        </div>
        <div className="figure">
          <strong>{loading ? '…' : monthSummary.peopleCount}</strong>
          <span>{t('personas atendidas este mes')}</span>
        </div>
        <div className="figure">
          <strong>{loading ? '…' : monthSummary.newPeopleCount}</strong>
          <span>{t('vinieron por primera vez')}</span>
        </div>
      </section>

      <section className="panel" aria-labelledby="recent-title">
        <div className="panel__head">
          <h2 id="recent-title">{t('Últimas atenciones')}</h2>
          <button className="link-button" onClick={() => onNavigate('attendances')} type="button">{t('Ver todas')}</button>
        </div>
        {loading ? (
          <p className="muted">{t('Cargando…')}</p>
        ) : recent.length ? (
          <ul className="activity">
            {recent.map((appointment) => {
              const person = peopleById.get(String(appointment.personId))
              return (
                <li key={appointment.id}>
                  <button className="activity__row" onClick={() => onOpenPerson(String(appointment.personId))} type="button">
                    <span className="activity__date">{relativeDay(appointment.date, locale, t)}</span>
                    <span className="activity__who">
                      <strong>{person?.name ?? t('Persona eliminada')}</strong>
                      {appointment.creatorName && <small>{t('Atendió: {name}', { name: appointment.creatorName })}</small>}
                    </span>
                    <ProcessTag process={appointment.process} />
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="empty">
            <p>{t('Todavía no hay atenciones. Busca o escribe el nombre de la primera persona arriba.')}</p>
          </div>
        )}
      </section>
    </div>
  )
}
