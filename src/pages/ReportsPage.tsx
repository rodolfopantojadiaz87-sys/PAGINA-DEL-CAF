import { useMemo, useState } from 'react'
import { FileText, Share2 } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { BarList } from '../components/BarList'
import { FilterBar } from '../components/FilterBar'
import { MonthChart } from '../components/MonthChart'
import { PageHeader } from '../components/PageHeader'
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

  return (
    <div className="page">
      <PageHeader
        title={t('Informes')}
        description={t('Resumen de las atenciones según el periodo y los filtros que elijas.')}
      />
      {error && <p className="message message--error" role="alert">{t(error)}</p>}

      <FilterBar collaborators={collaborators} filters={filters} nationalities={nationalities} onChange={onFiltersChange} />

      <section className="figures" aria-label={t('Cifras del periodo')}>
        <div className="figure figure--lead">
          <strong>{loading ? '…' : summary.peopleCount}</strong>
          <span>{t('personas atendidas')}</span>
          <small>{t('Cada persona cuenta una vez, aunque venga varias veces.')}</small>
        </div>
        <div className="figure">
          <strong>{loading ? '…' : summary.newPeopleCount}</strong>
          <span>{t('vinieron por primera vez')}</span>
        </div>
        <div className="figure">
          <strong>{loading ? '…' : summary.appointmentCount}</strong>
          <span>{t('atenciones')}</span>
          <button className="link-button" disabled={!summary.appointmentCount} onClick={() => onNavigate('attendances')} type="button">{t('Ver el listado')}</button>
        </div>
      </section>

      <section className="panel" aria-labelledby="months-title">
        <div className="panel__head"><h2 id="months-title">{t('Atenciones por mes')}</h2></div>
        <MonthChart months={summary.months} />
      </section>

      <div className="panel-grid">
        <section className="panel" aria-labelledby="processes-title">
          <div className="panel__head">
            <h2 id="processes-title">{t('Por proceso')}</h2>
            <p>{t('Atenciones de cada trámite')}</p>
          </div>
          <BarList
            color={(item) => processColor(item.label)}
            emptyText={t('No hay atenciones en este periodo.')}
            items={summary.processes}
            label={(item) => getProcessLabel(item.label, language)}
          />
        </section>
        <section className="panel" aria-labelledby="nationalities-title">
          <div className="panel__head">
            <h2 id="nationalities-title">{t('Por nacionalidad')}</h2>
            <p>{t('Personas distintas de cada país')}</p>
          </div>
          <BarList emptyText={t('No hay atenciones en este periodo.')} items={summary.nationalities} limit={10} otherLabel={t('Otras')} />
        </section>
      </div>

      <section className="panel" aria-labelledby="team-title">
        <div className="panel__head">
          <h2 id="team-title">{t('Por colaborador')}</h2>
          <p>{t('Quién registró las atenciones')}</p>
        </div>
        <BarList color={() => 'var(--ink-soft)'} emptyText={t('No hay atenciones en este periodo.')} items={summary.collaborators} />
      </section>

      <section className="export" aria-labelledby="export-title">
        <div>
          <h2 id="export-title">{t('Descargar informe en PDF')}</h2>
          <p>{t('Incluye el periodo, los filtros aplicados, las cifras y los gráficos de esta página.')}</p>
          <label className="checkbox">
            <input checked={includeDetail} onChange={(event) => setIncludeDetail(event.target.checked)} type="checkbox" />
            <span>{t('Añadir el listado de las {count} atenciones', { count: summary.appointmentCount })}</span>
          </label>
        </div>
        <div className="button-row">
          <button className="button button--primary" disabled={busy || loading} onClick={() => void run('download')} type="button"><FileText size={16} aria-hidden="true" />{busy ? t('Generando…') : t('Descargar PDF')}</button>
          <button className="button button--secondary" disabled={busy || loading} onClick={() => void run('share')} type="button"><Share2 size={16} aria-hidden="true" />{t('Compartir')}</button>
        </div>
        {message && <p className={`message message--${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>{t(message.text)}</p>}
      </section>
    </div>
  )
}
