import { Fragment, useMemo, useState } from 'react'
import { Download, FileText, Search } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { FilterBar } from '../components/FilterBar'
import { PageHeader } from '../components/PageHeader'
import { ProcessTag } from '../components/ProcessTag'
import { useAttendanceData } from '../hooks/useAttendanceData'
import { getLocale, getProcessLabel, useI18n } from '../i18n'
import { downloadCsv } from '../lib/csv'
import { formatDate, relativeDay } from '../lib/dates'
import {
  collaboratorOptions,
  filterAppointments,
  nationalityOptions,
  resolvePeriod,
  type AttendanceFilters,
} from '../lib/filters'
import { describeFilters, describePeriod, fileSuffix } from '../lib/reportFilters'
import { fold } from '../lib/search'
import { downloadReport } from '../pdf/exportReport'
import { summarizeAttendances } from '../statistics/aggregates'

const PAGE_SIZE = 100

interface AttendancesPageProps {
  filters: AttendanceFilters
  onFiltersChange: (filters: AttendanceFilters) => void
  onOpenPerson: (personId: string) => void
}

/** Registro cronológico de todas las atenciones, con filtros y exportación. */
export function AttendancesPage({ filters, onFiltersChange, onOpenPerson }: AttendancesPageProps) {
  const { language, t } = useI18n()
  const locale = getLocale(language)
  const { user } = useAuth()
  const { people, appointments, peopleById, loading, error } = useAttendanceData()
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [exportError, setExportError] = useState('')
  const [exporting, setExporting] = useState(false)

  const nationalities = useMemo(() => nationalityOptions(people), [people])
  const collaborators = useMemo(() => collaboratorOptions(appointments), [appointments])
  const filtered = useMemo(() => {
    const term = fold(query)
    return filterAppointments(appointments, peopleById, filters)
      .filter((appointment) => !term || fold(peopleById.get(String(appointment.personId))?.name ?? '').includes(term))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [appointments, filters, peopleById, query])
  const peopleCount = useMemo(() => new Set(filtered.map(({ personId }) => String(personId))).size, [filtered])

  const rows = filtered.slice(0, visible)

  function exportCsv() {
    downloadCsv(
      `atenciones-${fileSuffix(filters)}.csv`,
      [t('Fecha'), t('Persona'), t('Nacionalidad'), t('Teléfono'), t('Correo'), t('Proceso'), t('Atendió')],
      filtered.map((appointment) => {
        const person = peopleById.get(String(appointment.personId))
        return [
          appointment.date,
          person?.name ?? '',
          person?.nationality ?? '',
          person?.phone ?? '',
          person?.email ?? '',
          getProcessLabel(appointment.process, language),
          appointment.creatorName ?? '',
        ]
      }),
    )
  }

  async function exportPdf() {
    setExporting(true)
    setExportError('')
    try {
      const filterLines = describeFilters(filters, collaborators, language)
      if (query.trim()) filterLines.push(`${t('Persona')}: ${query.trim()}`)
      await downloadReport(
        {
          summary: summarizeAttendances(filtered, peopleById, resolvePeriod(filters)),
          periodText: describePeriod(filters, language),
          filterLines,
          generatedBy: user?.email ?? '',
          language,
          detail: { appointments: filtered, peopleById },
        },
        `atenciones-${fileSuffix(filters)}.pdf`,
      )
    } catch (caught) {
      setExportError(caught instanceof Error ? caught.message : 'No se pudo generar el PDF.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page">
      <PageHeader
        title={t('Atenciones')}
        description={loading ? t('Cargando…') : t('{count} atenciones de {people} personas con estos filtros', { count: filtered.length, people: peopleCount })}
        actions={
          <>
            <button className="button button--secondary" disabled={!filtered.length} onClick={exportCsv} type="button"><Download size={16} aria-hidden="true" />{t('Exportar CSV')}</button>
            <button className="button button--secondary" disabled={!filtered.length || exporting} onClick={() => void exportPdf()} type="button"><FileText size={16} aria-hidden="true" />{exporting ? t('Generando…') : t('Exportar PDF')}</button>
          </>
        }
      />
      {error && <p className="message message--error" role="alert">{t(error)}</p>}
      {exportError && <p className="message message--error" role="alert">{t(exportError)}</p>}

      <FilterBar collaborators={collaborators} filters={filters} nationalities={nationalities} onChange={(next) => { onFiltersChange(next); setVisible(PAGE_SIZE) }} />

      <label className="search-field search-field--inline">
        <Search size={18} aria-hidden="true" />
        <span className="visually-hidden">{t('Buscar persona en el listado')}</span>
        <input onChange={(event) => { setQuery(event.target.value); setVisible(PAGE_SIZE) }} placeholder={t('Buscar persona en el listado')} type="search" value={query} />
      </label>

      {loading ? (
        <p className="muted">{t('Cargando…')}</p>
      ) : filtered.length ? (
        <>
          <table className="data-table data-table--log">
            <thead>
              <tr>
                <th scope="col">{t('Persona')}</th>
                <th scope="col">{t('Proceso')}</th>
                <th scope="col">{t('Atendió')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((appointment, index) => {
                const person = peopleById.get(String(appointment.personId))
                const showDate = index === 0 || rows[index - 1].date !== appointment.date
                return (
                  <Fragment key={appointment.id}>
                    {showDate && (
                      <tr className="data-table__group">
                        <th colSpan={3} scope="rowgroup">
                          {relativeDay(appointment.date, locale, t)}
                          {relativeDay(appointment.date, locale, t) !== formatDate(appointment.date, locale) && <span>{formatDate(appointment.date, locale)}</span>}
                        </th>
                      </tr>
                    )}
                    <tr>
                      <td>
                        <button className="row-link" onClick={() => onOpenPerson(String(appointment.personId))} type="button">
                          <span><strong>{person?.name ?? t('Persona eliminada')}</strong><small>{person?.nationality}</small></span>
                        </button>
                      </td>
                      <td><ProcessTag process={appointment.process} /></td>
                      <td className="data-table__muted">{appointment.creatorName ?? '—'}</td>
                    </tr>
                  </Fragment>
                )
              })}
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
          <p>{appointments.length ? t('No hay atenciones con estos filtros. Prueba con otro periodo.') : t('Todavía no hay atenciones registradas.')}</p>
        </div>
      )}
    </div>
  )
}
