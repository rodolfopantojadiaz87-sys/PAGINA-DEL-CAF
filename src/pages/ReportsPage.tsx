import { useMemo, useState, type ReactNode } from 'react'
import { FileText, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '../auth/useAuth'
import { BarList } from '../components/BarList'
import { FilterBar } from '../components/FilterBar'
import { FormAlert } from '../components/FormAlert'
import { MonthChart } from '../components/MonthChart'
import { PageHeader } from '../components/PageHeader'
import { StatCard } from '../components/StatCard'
import { useAttendanceData } from '../hooks/useAttendanceData'
import { getProcessLabel, useI18n } from '../i18n'
import {
  collaboratorOptions,
  filterAppointments,
  nationalityOptions,
  resolvePeriod,
  type AttendanceFilters,
} from '../lib/filters'
import { processColor } from '../lib/processes'
import { describeFilters, describePeriod, fileSuffix } from '../lib/reportFilters'
import { downloadReport, shareReport } from '../pdf/exportReport'
import type { ReportInput } from '../pdf/report'
import { summarizeAttendances } from '../statistics/aggregates'
import type { Section } from '../types/records'

interface ReportsPageProps {
  filters: AttendanceFilters
  onFiltersChange: (filters: AttendanceFilters) => void
  onNavigate: (section: Section) => void
}

export function ReportsPage({ filters, onFiltersChange, onNavigate }: ReportsPageProps) {
  const { language, t } = useI18n()
  const { user } = useAuth()
  const { people, appointments, peopleById, loading, error } = useAttendanceData()
  const [includeDetail, setIncludeDetail] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string }>()

  const nationalities = useMemo(() => nationalityOptions(people), [people])
  const collaborators = useMemo(() => collaboratorOptions(appointments), [appointments])
  const filtered = useMemo(() => filterAppointments(appointments, peopleById, filters), [appointments, filters, peopleById])
  const summary = useMemo(() => summarizeAttendances(filtered, peopleById, resolvePeriod(filters)), [filtered, filters, peopleById])
  const periodText = describePeriod(filters, language)

  function reportInput(): ReportInput {
    return {
      summary,
      periodText,
      filterLines: describeFilters(filters, collaborators, language),
      generatedBy: user?.email ?? '',
      language,
      ...(includeDetail ? { detail: { appointments: filtered, peopleById } } : {}),
    }
  }

  const filename = `informe-${fileSuffix(filters)}.pdf`

  async function run(action: 'download' | 'share') {
    setBusy(true)
    setMessage(undefined)
    try {
      if (action === 'share') {
        const shared = await shareReport(reportInput(), filename, t('Informe de atenciones'))
        if (!shared) {
          await downloadReport(reportInput(), filename)
          setMessage({ kind: 'success', text: 'Este dispositivo no permite compartir directamente. El PDF se descargó: adjúntalo en WhatsApp o en el correo.' })
        }
      } else {
        await downloadReport(reportInput(), filename)
      }
    } catch (caught) {
      setMessage({ kind: 'error', text: caught instanceof Error ? caught.message : 'No se pudo generar el PDF.' })
    } finally {
      setBusy(false)
    }
  }

  const figure = (value: number) => (loading ? <Skeleton className="h-9 w-12" /> : value)
  const panel = (title: string, description: string | undefined, content: ReactNode) => (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Informes')}
        description={t('Resumen de las atenciones según el periodo y los filtros que elijas.')}
      />
      {error && <FormAlert>{t(error)}</FormAlert>}

      <FilterBar collaborators={collaborators} filters={filters} nationalities={nationalities} onChange={onFiltersChange} />

      <section aria-label={t('Cifras del periodo')} className="grid gap-3 sm:grid-cols-3">
        <StatCard hint={t('Cada persona cuenta una vez, aunque venga varias veces.')} label={t('personas atendidas')} value={figure(summary.peopleCount)} />
        <StatCard label={t('vinieron por primera vez')} value={figure(summary.newPeopleCount)} />
        <StatCard
          footer={<Button className="h-auto px-0" disabled={!summary.appointmentCount} onClick={() => onNavigate('attendances')} size="sm" variant="link">{t('Ver el listado')}</Button>}
          label={t('atenciones')}
          value={figure(summary.appointmentCount)}
        />
      </section>

      {panel(t('Atenciones por mes'), periodText, <MonthChart months={summary.months} />)}

      <div className="grid gap-6 lg:grid-cols-2">
        {panel(t('Por proceso'), t('Atenciones de cada trámite'), (
          <BarList
            color={(item) => processColor(item.label)}
            emptyText={t('No hay atenciones en este periodo.')}
            items={summary.processes}
            label={(item) => getProcessLabel(item.label, language)}
          />
        ))}
        {panel(t('Por nacionalidad'), t('Personas distintas de cada país'), (
          <BarList emptyText={t('No hay atenciones en este periodo.')} items={summary.nationalities} limit={10} otherLabel={t('Otras')} />
        ))}
      </div>

      {panel(t('Por colaborador'), t('Quién registró las atenciones'), (
        <BarList color={() => 'var(--muted-foreground)'} emptyText={t('No hay atenciones en este periodo.')} items={summary.collaborators} />
      ))}

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>{t('Descargar informe en PDF')}</CardTitle>
          <CardDescription>{t('Incluye el periodo, los filtros aplicados, las cifras y los gráficos de esta página.')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox checked={includeDetail} id="include-detail" onCheckedChange={(checked) => setIncludeDetail(checked === true)} />
            <Label className="font-normal" htmlFor="include-detail">{t('Añadir el listado de las {count} atenciones', { count: summary.appointmentCount })}</Label>
          </div>
          {message && <FormAlert kind={message.kind}>{t(message.text)}</FormAlert>}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2 border-t">
          <Button disabled={busy || loading} onClick={() => void run('download')}><FileText aria-hidden="true" />{busy ? t('Generando…') : t('Descargar PDF')}</Button>
          <Button disabled={busy || loading} onClick={() => void run('share')} variant="outline"><Share2 aria-hidden="true" />{t('Compartir')}</Button>
        </CardFooter>
      </Card>
    </div>
  )
}
