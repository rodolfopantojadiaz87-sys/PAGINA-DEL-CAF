import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartNoAxesCombined,
  ClipboardList,
  Download,
  Mail,
  MessageCircle,
  Share2,
  UsersRound,
} from 'lucide-react'
import { NationalityLegend } from '../components/NationalityLegend'
import { useWorkspace } from '../auth/useWorkspace'
import { SectionTitle } from '../components/SectionTitle'
import { useAttendanceData } from '../hooks/useAttendanceData'
import { countDistinctAttendedPeople } from '../services/attendanceService'
import { useNationalityColors } from '../hooks/useNationalityColors'
import {
  colorsForNationalities,
  ensureNationalityColors,
} from '../services/nationalityColors'
import { createAllTimeSummary, createSummary } from '../statistics/aggregates'
import { getProcessLabel, useI18n } from '../i18n'

export function ReportsPage() {
  const { language, t } = useI18n()
  const { people, appointments, error: dataError } = useAttendanceData()
  const { access } = useWorkspace()
  const [currentDate] = useState(() => new Date())
  const [year, setYear] = useState(currentDate.getFullYear())
  const [semester, setSemester] = useState<1 | 2>(currentDate.getMonth() < 6 ? 1 : 2)
  const [shareError, setShareError] = useState('')
  const [shareNotice, setShareNotice] = useState('')
  const [distinctPeopleResult, setDistinctPeopleResult] = useState<{
    workspaceId: string
    year: number
    semester: 1 | 2
    count?: number
    error?: string
  }>()
  const workspaceId = access.status === 'active' ? access.membership.workspace_id : undefined
  const localSummary = useMemo(() => createSummary(people, appointments, year, semester), [people, appointments, year, semester])
  const allTimeSummary = useMemo(() => createAllTimeSummary(people, appointments), [people, appointments])
  const currentDistinctResult =
    distinctPeopleResult?.workspaceId === workspaceId &&
    distinctPeopleResult?.year === year &&
    distinctPeopleResult?.semester === semester
      ? distinctPeopleResult
      : undefined
  const summary = {
    ...localSummary,
    peopleCount: currentDistinctResult?.count ?? 0,
  }
  const distinctCountPending =
    currentDistinctResult?.count === undefined && !currentDistinctResult?.error

  useEffect(() => {
    if (!workspaceId) return
    let active = true
    void countDistinctAttendedPeople(workspaceId, year, semester).then(
      (count) => {
        if (active) setDistinctPeopleResult({ workspaceId, year, semester, count })
      },
      (caught: unknown) => {
        if (active) {
          setDistinctPeopleResult({
            workspaceId,
            year,
            semester,
            error: caught instanceof Error ? caught.message : 'No se pudo contar el número de personas distintas del período.',
          })
        }
      },
    )
    return () => {
      active = false
    }
  }, [workspaceId, year, semester])
  const { colors: savedColors, error: colorError, ready: colorsReady } = useNationalityColors(
    summary.nationalities.map(({ label }) => label),
  )
  const nationalityColors = colorsForNationalities(summary.nationalities, savedColors)
  const years = [...new Set([currentDate.getFullYear(), ...appointments.map(({ date }) => Number(date.slice(0, 4)))])].sort((a, b) => b - a)
  const nationalities = summary.nationalities.map((item) => ({
    name: item.label,
    value: item.count,
    percentage: item.percentage,
    color: nationalityColors[item.label],
  }))
  const processes = summary.processes.map(({ label, count }) => ({ name: getProcessLabel(label, language), cantidad: count }))
  const period = semester === 1 ? t('enero a junio') : t('julio a diciembre')

  async function createReportFile(): Promise<File> {
    if (currentDistinctResult?.count === undefined) {
      throw new Error('El total de personas distintas del período aún no está disponible.')
    }
    const { getReportFile } = await import('../pdf/semesterReport')
    const reportColors = await ensureNationalityColors(
      summary.nationalities.map(({ label }) => label),
    )
    return getReportFile(summary, reportColors, language)
  }

  function saveFile(file: File) {
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function shareReport() {
    setShareError('')
    setShareNotice('')
    try {
      const file = await createReportFile()
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: t('Informe semestral de atenciones'), files: [file] })
      } else {
        saveFile(file)
        setShareNotice('El PDF se descargó. Adjunta ese archivo en WhatsApp o en tu correo.')
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setShareError(error instanceof Error ? error.message : 'No se pudo generar el PDF.')
    }
  }

  async function downloadReport() {
    setShareError('')
    setShareNotice('')
    try {
      saveFile(await createReportFile())
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'No se pudo generar el PDF.')
    }
  }

  const message = encodeURIComponent(
    `${t('Informe semestral de atenciones')} · ${t(semester === 1 ? 'Primer' : 'Segundo')} ${t('semestre')} ${year}\n${t('Personas atendidas')}: ${summary.peopleCount}\n${t('Atenciones')}: ${summary.appointmentCount}\n${t('Procesos realizados')}: ${summary.processCount}`,
  )

  return (
    <div className="page-stack">
      <SectionTitle eyebrow={t('RESUMEN GENERAL')} title={t('Estadísticas e informes')} description={t('Consulta las estadísticas generales y los resultados de cada semestre en un solo lugar.')} />
      {dataError && <p className="form-message form-message--error" role="alert">{t(dataError)}</p>}
      {currentDistinctResult?.error && <p className="form-message form-message--error" role="alert">{t(currentDistinctResult.error)}</p>}
      {colorError && <p className="form-message form-message--error" role="alert">{t(colorError)}</p>}
      <section>
        <div className="card-heading"><div><h2>{t('Estadísticas generales')}</h2><p>{t('Resumen acumulado de todas las atenciones registradas.')}</p></div></div>
        <div className="stats-grid">
          <article className="metric-card"><div className="metric-card__top"><span className="metric-card__icon metric-card__icon--green"><UsersRound size={19} /></span><span className="metric-card__trend">{t('Total')}</span></div><p>{t('Personas distintas')}</p><strong>{allTimeSummary.peopleCount}</strong><small>{t('Sin contar visitas repetidas')}</small></article>
          <article className="metric-card"><div className="metric-card__top"><span className="metric-card__icon metric-card__icon--blue"><ClipboardList size={19} /></span><span className="metric-card__trend">{t('Total')}</span></div><p>{t('Atenciones realizadas')}</p><strong>{allTimeSummary.appointmentCount}</strong><small>{t('Visitas guardadas')}</small></article>
          <article className="metric-card"><div className="metric-card__top"><span className="metric-card__icon metric-card__icon--amber"><ChartNoAxesCombined size={19} /></span><span className="metric-card__trend">{t('Total')}</span></div><p>{t('Procesos realizados')}</p><strong>{allTimeSummary.processCount}</strong><small>{t('Un proceso por atención')}</small></article>
        </div>
      </section>
      <div className="card-heading"><div><h2>{t('Resumen semestral')}</h2><p>{t('Selecciona un período para consultar y exportar sus resultados.')}</p></div></div>
      <div className="report-controls surface-card">
        <label className="field"><span>{t('Año')}</span><select onChange={(event) => setYear(Number(event.target.value))} value={year}>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="field"><span>{t('Semestre')}</span><select onChange={(event) => setSemester(Number(event.target.value) as 1 | 2)} value={semester}><option value={1}>{t('Primer semestre · enero a junio')}</option><option value={2}>{t('Segundo semestre · julio a diciembre')}</option></select></label>
        <span className="report-period">{period} {t('de')} {year}</span>
      </div>
      <section className="report-highlight">
        <p>{t('TOTAL GENERAL DE PERSONAS ATENDIDAS')}</p>
        <strong>{distinctCountPending ? '…' : currentDistinctResult?.error ? '—' : summary.peopleCount}</strong>
        <span>{t(semester === 1 ? 'personas distintas durante el primer semestre' : 'personas distintas durante el segundo semestre')}</span>
      </section>
      <section className="stats-grid stats-grid--two">
        <article className="metric-card metric-card--plain"><p>{t('Total de atenciones')}</p><strong>{summary.appointmentCount}</strong><small>{t('Visitas realizadas en el período')}</small></article>
        <article className="metric-card metric-card--plain"><p>{t('Total de procesos')}</p><strong>{summary.processCount}</strong><small>{t('Procesos realizados en el período')}</small></article>
      </section>
      <section className="charts-grid">
        <article className="surface-card chart-card"><div className="card-heading"><div><h2>{t('Personas por nacionalidad')}</h2><p>{t('Personas distintas por nacionalidad en el semestre.')}</p></div></div>{nationalities.length && !colorsReady ? <div className="chart-empty">{t('Asignando colores a las nacionalidades…')}</div> : nationalities.length ? <div className="nationality-visualization"><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={nationalities} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={54} outerRadius={88} paddingAngle={3}>{nationalities.map((item) => <Cell fill={item.color} key={item.name} />)}</Pie><Tooltip formatter={(value, name, item) => [t('{count} personas ({percentage}%)', { count: String(value ?? 0), percentage: Number(item.payload.percentage).toFixed(1) }), name]} /></PieChart></ResponsiveContainer></div><NationalityLegend items={summary.nationalities} colors={nationalityColors} /></div> : <div className="chart-empty">{t('No hay atenciones en este semestre.')}</div>}</article>
        <article className="surface-card chart-card"><div className="card-heading"><div><h2>{t('Procesos realizados')}</h2><p>{t('Frecuencia por tipo de proceso.')}</p></div></div>{processes.length ? <div className="chart-area chart-area--wide"><ResponsiveContainer width="100%" height="100%"><BarChart data={processes} margin={{ top: 10, right: 12, left: -18, bottom: 36 }}><CartesianGrid stroke="#edf0ec" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} tick={{ fontSize: 10, fill: '#667269' }} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#667269' }} /><Tooltip /><Bar dataKey="cantidad" name={t('Procesos realizados')} fill="#527e5c" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div> : <div className="chart-empty">{t('No hay atenciones en este semestre.')}</div>}</article>
      </section>
      <section className="report-tables">
        <article className="surface-card table-card"><div className="card-heading"><div><h2>{t('Clasificación por nacionalidad')}</h2><p>{t('Personas únicas · porcentaje del total de personas')}</p></div></div><div className="table-scroll"><table><thead><tr><th>{t('Nacionalidad')}</th><th>{t('Personas')}</th><th>{t('Porcentaje')}</th></tr></thead><tbody>{summary.nationalities.map((row) => <tr key={row.label}><td>{row.label}</td><td>{row.count}</td><td>{row.percentage.toFixed(1)}%</td></tr>)}{!summary.nationalities.length && <tr><td className="table-empty" colSpan={3}>{t('Sin datos para este período.')}</td></tr>}</tbody></table></div></article>
        <article className="surface-card table-card"><div className="card-heading"><div><h2>{t('Clasificación por proceso')}</h2><p>{t('Procesos realizados · porcentaje del total de procesos')}</p></div></div><div className="table-scroll"><table><thead><tr><th>{t('Proceso')}</th><th>{t('Veces realizado')}</th><th>{t('Porcentaje')}</th></tr></thead><tbody>{summary.processes.map((row) => <tr key={row.label}><td><span className="process-pill">{getProcessLabel(row.label, language)}</span></td><td>{row.count}</td><td>{row.percentage.toFixed(1)}%</td></tr>)}{!summary.processes.length && <tr><td className="table-empty" colSpan={3}>{t('Sin datos para este período.')}</td></tr>}</tbody></table></div></article>
      </section>
      <div className="surface-card report-share">
        <div><h2>{t('Generar y compartir informe')}</h2><p>{t('El PDF incluye el resumen, las tablas y gráficos del semestre seleccionado.')}</p></div>
        <div className="report-share__actions">
          <button className="button button--primary" disabled={distinctCountPending || Boolean(currentDistinctResult?.error) || Boolean(dataError)} onClick={() => void downloadReport()} type="button"><Download size={17} />{t('Descargar PDF')}</button>
          <button className="button button--secondary" disabled={distinctCountPending || Boolean(currentDistinctResult?.error) || Boolean(dataError)} onClick={() => void shareReport()} type="button"><Share2 size={17} />{t('Compartir PDF')}</button>
          {!distinctCountPending && !currentDistinctResult?.error && !dataError ? (
            <>
              <a className="button button--ghost" href={`https://wa.me/?text=${message}`} rel="noreferrer" target="_blank"><MessageCircle size={17} />{t('WhatsApp · resumen')}</a>
              <a className="button button--ghost" href={`mailto:?subject=${encodeURIComponent(`${t('Informe semestral')} ${year}`)}&body=${message}`}><Mail size={17} />{t('Correo · resumen')}</a>
            </>
          ) : (
            <>
              <span className="button button--ghost button--disabled" aria-disabled="true"><MessageCircle size={17} />{t('WhatsApp · resumen')}</span>
              <span className="button button--ghost button--disabled" aria-disabled="true"><Mail size={17} />{t('Correo · resumen')}</span>
            </>
          )}
        </div>
        {shareError && <p className="form-message form-message--error" role="alert">{t(shareError)}</p>}
        {shareNotice && <p className="form-message form-message--success" role="status">{t(shareNotice)}</p>}
      </div>
    </div>
  )
}
