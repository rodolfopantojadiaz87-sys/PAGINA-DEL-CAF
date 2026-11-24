import { Fragment, useMemo, useState } from 'react'
import { Download, FileText, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '../auth/useAuth'
import { EmptyState } from '../components/EmptyState'
import { FilterBar } from '../components/FilterBar'
import { FormAlert } from '../components/FormAlert'
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
    <div className="space-y-6">
      <PageHeader
        title={t('Atenciones')}
        description={loading ? t('Cargando…') : t('{count} atenciones de {people} personas con estos filtros', { count: filtered.length, people: peopleCount })}
        actions={
          <>
            <Button disabled={!filtered.length} onClick={exportCsv} variant="outline"><Download aria-hidden="true" />{t('Exportar CSV')}</Button>
            <Button disabled={!filtered.length || exporting} onClick={() => void exportPdf()} variant="outline"><FileText aria-hidden="true" />{exporting ? t('Generando…') : t('Exportar PDF')}</Button>
          </>
        }
      />
      {error && <FormAlert>{t(error)}</FormAlert>}
      {exportError && <FormAlert>{t(exportError)}</FormAlert>}

      <FilterBar collaborators={collaborators} filters={filters} nationalities={nationalities} onChange={(next) => { onFiltersChange(next); setVisible(PAGE_SIZE) }} />

      <div className="relative max-w-md">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label={t('Buscar persona en el listado')} className="bg-background pl-9" onChange={(event) => { setQuery(event.target.value); setVisible(PAGE_SIZE) }} placeholder={t('Buscar persona en el listado')} type="search" value={query} />
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((key) => <Skeleton className="h-12 w-full" key={key} />)}</div>
      ) : filtered.length ? (
        <>
          <Card className="gap-0 overflow-hidden py-0 shadow-none">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">{t('Persona')}</TableHead>
                  <TableHead>{t('Proceso')}</TableHead>
                  <TableHead className="hidden pr-4 sm:table-cell">{t('Atendió')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((appointment, index) => {
                  const person = peopleById.get(String(appointment.personId))
                  const showDate = index === 0 || rows[index - 1].date !== appointment.date
                  const relative = relativeDay(appointment.date, locale, t)
                  const full = formatDate(appointment.date, locale)
                  return (
                    <Fragment key={appointment.id}>
                      {showDate && (
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="h-8 pl-4 text-xs font-medium" colSpan={3} scope="rowgroup">
                            {relative}
                            {relative !== full && <span className="ml-2 font-normal text-muted-foreground">{full}</span>}
                          </TableHead>
                        </TableRow>
                      )}
                      <TableRow>
                        <TableCell className="pl-4">
                          <button className="text-left" onClick={() => onOpenPerson(String(appointment.personId))} type="button">
                            <span className="block font-medium hover:underline">{person?.name ?? t('Persona eliminada')}</span>
                            <span className="block text-xs text-muted-foreground">{person?.nationality}</span>
                          </button>
                        </TableCell>
                        <TableCell><ProcessTag process={appointment.process} /></TableCell>
                        <TableCell className="hidden pr-4 text-muted-foreground sm:table-cell">{appointment.creatorName ?? '—'}</TableCell>
                      </TableRow>
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
          {visible < filtered.length && (
            <Button className="w-full" onClick={() => setVisible((count) => count + PAGE_SIZE)} variant="outline">
              {t('Mostrar {count} más', { count: Math.min(PAGE_SIZE, filtered.length - visible) })}
            </Button>
          )}
        </>
      ) : (
        <EmptyState>{appointments.length ? t('No hay atenciones con estos filtros. Prueba con otro periodo.') : t('Todavía no hay atenciones registradas.')}</EmptyState>
      )}
    </div>
  )
}
