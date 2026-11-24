import { useMemo, useState } from 'react'
import { Download, Plus, Search, X } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { useAttendanceData } from '../hooks/useAttendanceData'
import { getLocale, getProcessLabel, useI18n } from '../i18n'
import { downloadCsv } from '../lib/csv'
import { formatDate, localDate, relativeDay } from '../lib/dates'
import { nationalityOptions, normalizedKey } from '../lib/filters'
import { searchPeople } from '../lib/search'
import { PROCESS_OPTIONS } from '../types/records'
import type { RegistrationTarget } from '../App'

type SortOrder = 'recent' | 'name' | 'visits'
const PAGE_SIZE = 50

interface PeoplePageProps {
  onOpenPerson: (personId: string) => void
  onRegister: (target: RegistrationTarget) => void
}

export function PeoplePage({ onOpenPerson, onRegister }: PeoplePageProps) {
  const { language, t } = useI18n()
  const locale = getLocale(language)
  const { people, loading, error } = useAttendanceData()
  const [query, setQuery] = useState('')
  const [nationality, setNationality] = useState('')
  const [process, setProcess] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState<SortOrder>('recent')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const nationalities = useMemo(() => nationalityOptions(people), [people])
  const filtered = useMemo(() => {
    const byNationality = nationality
      ? people.filter((person) => normalizedKey(person.nationality) === normalizedKey(nationality))
      : people
    // Proceso y fechas se aplican juntos: alguna atención de ese proceso dentro del rango.
    const byAttendance = process || from || to
      ? byNationality.filter((person) => person.appointments.some((item) =>
          (!process || item.process === process) &&
          (!from || item.date >= from) &&
          (!to || item.date <= to)))
      : byNationality
    const matched = searchPeople(byAttendance, query)
    // Con búsqueda, el orden lo da la relevancia; sin ella, el orden elegido.
    if (query.trim()) return matched
    return [...matched].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'visits') return b.appointments.length - a.appointments.length || a.name.localeCompare(b.name)
      return (b.lastAppointment?.date ?? '').localeCompare(a.lastAppointment?.date ?? '') || a.name.localeCompare(b.name)
    })
  }, [from, nationality, people, process, query, sort, to])

  const hasFilters = Boolean(query || nationality || process || from || to)

  function exportCsv() {
    downloadCsv(
      `personas-${localDate()}.csv`,
      [t('Nombre'), t('Nacionalidad'), t('Teléfono'), t('Correo'), t('Atenciones'), t('Primera visita'), t('Última visita')],
      filtered.map((person) => [
        person.name,
        person.nationality,
        person.phone,
        person.email,
        person.appointments.length,
        person.appointments.length ? formatDate(person.appointments[person.appointments.length - 1].date, locale) : '',
        person.lastAppointment ? formatDate(person.lastAppointment.date, locale) : '',
      ]),
    )
  }

  return (
    <div className="page">
      <PageHeader
        title={t('Personas')}
        description={loading ? t('Cargando…') : t('{count} personas registradas', { count: people.length })}
        actions={
          <>
            <button className="button button--secondary" disabled={!filtered.length} onClick={exportCsv} type="button"><Download size={16} aria-hidden="true" />{t('Exportar CSV')}</button>
            <button className="button button--primary" onClick={() => onRegister({})} type="button"><Plus size={16} aria-hidden="true" />{t('Persona nueva')}</button>
          </>
        }
      />
      {error && <p className="message message--error" role="alert">{t(error)}</p>}

      <div className="toolbar">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <span className="visually-hidden">{t('Buscar')}</span>
          <input onChange={(event) => { setQuery(event.target.value); setVisible(PAGE_SIZE) }} placeholder={t('Buscar por nombre, teléfono o correo')} type="search" value={query} />
        </label>
        <label className="field field--compact">
          <span>{t('Nacionalidad')}</span>
          <select onChange={(event) => { setNationality(event.target.value); setVisible(PAGE_SIZE) }} value={nationality}>
            <option value="">{t('Todas')}</option>
            {nationalities.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="field field--compact">
          <span>{t('Algún trámite de')}</span>
          <select onChange={(event) => { setProcess(event.target.value); setVisible(PAGE_SIZE) }} value={process}>
            <option value="">{t('Cualquier proceso')}</option>
            {PROCESS_OPTIONS.map((item) => <option key={item} value={item}>{getProcessLabel(item, language)}</option>)}
          </select>
        </label>
        <label className="field field--compact">
          <span>{t('Con atención desde')}</span>
          <input max={to || undefined} onChange={(event) => { setFrom(event.target.value); setVisible(PAGE_SIZE) }} type="date" value={from} />
        </label>
        <label className="field field--compact">
          <span>{t('Hasta')}</span>
          <input min={from || undefined} onChange={(event) => { setTo(event.target.value); setVisible(PAGE_SIZE) }} type="date" value={to} />
        </label>
        <label className="field field--compact">
          <span>{t('Ordenar por')}</span>
          <select disabled={Boolean(query.trim())} onChange={(event) => setSort(event.target.value as SortOrder)} value={sort}>
            <option value="recent">{t('Visita más reciente')}</option>
            <option value="name">{t('Nombre')}</option>
            <option value="visits">{t('Más atenciones')}</option>
          </select>
        </label>
      </div>

      <div className="result-line">
        <span>{t(filtered.length === 1 ? '{count} persona' : '{count} personas', { count: filtered.length })}</span>
        {hasFilters && (
          <button className="link-button" onClick={() => { setQuery(''); setNationality(''); setProcess(''); setFrom(''); setTo('') }} type="button">
            <X size={14} aria-hidden="true" />{t('Quitar filtros')}
          </button>
        )}
      </div>

      {loading ? (
        <p className="muted">{t('Cargando…')}</p>
      ) : filtered.length ? (
        <>
          <table className="data-table data-table--people">
            <thead>
              <tr>
                <th scope="col">{t('Persona')}</th>
                <th scope="col">{t('Contacto')}</th>
                <th scope="col">{t('Última visita')}</th>
                <th className="data-table__number" scope="col">{t('Atenciones')}</th>
                <th scope="col"><span className="visually-hidden">{t('Acciones')}</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, visible).map((person) => (
                <tr key={person.id}>
                  <td>
                    <button className="row-link" onClick={() => onOpenPerson(String(person.id))} type="button">
                      <span className="avatar" aria-hidden="true">{person.name.slice(0, 1).toLocaleUpperCase()}</span>
                      <span><strong>{person.name}</strong><small>{person.nationality}</small></span>
                    </button>
                  </td>
                  <td className="data-table__contact">
                    {person.phone && <span>{person.phone}</span>}
                    {person.email && <span>{person.email}</span>}
                    {!person.phone && !person.email && <span className="muted">—</span>}
                  </td>
                  <td data-label={t('Última visita')}>{person.lastAppointment ? relativeDay(person.lastAppointment.date, locale, t) : '—'}</td>
                  <td className="data-table__number" data-label={t('Atenciones')}>{person.appointments.length}</td>
                  <td className="data-table__action">
                    <button className="button button--secondary button--small" onClick={() => onRegister({ person })} type="button">
                      <Plus size={14} aria-hidden="true" />{t('Atención')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible < filtered.length && (
            <button className="button button--quiet button--block" onClick={() => setVisible((count) => count + PAGE_SIZE)} type="button">
              {t('Mostrar {count} más', { count: Math.min(PAGE_SIZE, filtered.length - visible) })}
            </button>
          )}
        </>
      ) : (
        <div className="empty">
          {people.length ? (
            <>
              <p>{t('Nadie coincide con la búsqueda o los filtros.')}</p>
              {query.trim() && (
                <button className="button button--primary" onClick={() => onRegister({ name: query.trim() })} type="button">
                  <Plus size={16} aria-hidden="true" />{t('Registrar a «{name}» como persona nueva', { name: query.trim() })}
                </button>
              )}
            </>
          ) : (
            <>
              <p>{t('Todavía no hay personas. Aparecen aquí al registrar su primera atención.')}</p>
              <button className="button button--primary" onClick={() => onRegister({})} type="button"><Plus size={16} aria-hidden="true" />{t('Registrar atención')}</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
