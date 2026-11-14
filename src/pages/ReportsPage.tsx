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
import { Download, Mail, MessageCircle, Share2 } from 'lucide-react'
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
import { createSummary } from '../statistics/aggregates'

export function ReportsPage() {
  const { people, appointments, error: dataError } = useAttendanceData()
  const { access } = useWorkspace()
  const [currentDate] = useState(() => new Date())
  const [year, setYear] = useState(currentDate.getFullYear())
  const [semester, setSemester] = useState<1 | 2>(currentDate.getMonth() < 6 ? 1 : 2)
  const [shareError, setShareError] = useState('')
  const [distinctPeopleResult, setDistinctPeopleResult] = useState<{
    workspaceId: string
    year: number
    semester: 1 | 2
    count?: number
    error?: string
  }>()
  const workspaceId = access.status === 'active' ? access.membership.workspace_id : undefined
  const localSummary = useMemo(() => createSummary(people, appointments, year, semester), [people, appointments, year, semester])
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
            error: caught instanceof Error ? caught.message : 'No se pudo contar las personas distintas del período.',
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
  const processes = summary.processes.map(({ label, count }) => ({ name: label, cantidad: count }))
  const period = semester === 1 ? 'enero a junio' : 'julio a diciembre'

  async function shareReport() {
    setShareError('')
    try {
      if (currentDistinctResult?.count === undefined) {
        throw new Error('El total de personas distintas del período aún no está disponible.')
      }
      const { getReportFile } = await import('../pdf/semesterReport')
      const reportColors = await ensureNationalityColors(
        summary.nationalities.map(({ label }) => label),
      )
      const file = getReportFile(summary, reportColors)
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'Informe semestral de atenciones', files: [file] })
      } else {
        await downloadReport()
        setShareError('El PDF se descargó. Adjunta ese archivo en WhatsApp o en tu correo.')
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') setShareError(error.message)
    }
  }

  async function downloadReport() {
    try {
      if (currentDistinctResult?.count === undefined) {
        throw new Error('El total de personas distintas del período aún no está disponible.')
      }
      const { getReportFile } = await import('../pdf/semesterReport')
      const reportColors = await ensureNationalityColors(
        summary.nationalities.map(({ label }) => label),
      )
      const file = getReportFile(summary, reportColors)
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'No se pudo generar el PDF.')
    }
  }

  const message = encodeURIComponent(
    `Informe semestral de atenciones · ${semester === 1 ? 'Primer' : 'Segundo'} semestre ${year}\nPersonas atendidas: ${summary.peopleCount}\nAtenciones: ${summary.appointmentCount}\nProcesos: ${summary.processCount}`,
  )

  return (
    <div className="page-stack">
      <SectionTitle eyebrow="INFORMES" title="Resumen semestral" description="Selecciona un período para consultar y exportar sus resultados." />
      {dataError && <p className="form-message form-message--error" role="alert">{dataError}</p>}
      {currentDistinctResult?.error && <p className="form-message form-message--error" role="alert">{currentDistinctResult.error}</p>}
      {colorError && <p className="form-message form-message--error" role="alert">{colorError}</p>}
      <div className="report-controls surface-card">
        <label className="field"><span>Año</span><select onChange={(event) => setYear(Number(event.target.value))} value={year}>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="field"><span>Semestre</span><select onChange={(event) => setSemester(Number(event.target.value) as 1 | 2)} value={semester}><option value={1}>Primer semestre · enero a junio</option><option value={2}>Segundo semestre · julio a diciembre</option></select></label>
        <span className="report-period">{period} de {year}</span>
      </div>
      <section className="report-highlight">
        <p>TOTAL GENERAL DE PERSONAS ATENDIDAS</p>
        <strong>{distinctCountPending ? '…' : currentDistinctResult?.error ? '—' : summary.peopleCount}</strong>
        <span>personas distintas durante el {semester === 1 ? 'primer' : 'segundo'} semestre</span>
      </section>
      <section className="stats-grid stats-grid--two">
        <article className="metric-card metric-card--plain"><p>Total de atenciones</p><strong>{summary.appointmentCount}</strong><small>Visitas realizadas en el período</small></article>
        <article className="metric-card metric-card--plain"><p>Total de procesos</p><strong>{summary.processCount}</strong><small>Procesos realizados en el período</small></article>
      </section>
      <section className="charts-grid">
        <article className="surface-card chart-card"><div className="card-heading"><div><h2>Personas por nacionalidad</h2><p>Personas distintas por nacionalidad en el semestre.</p></div></div>{nationalities.length && !colorsReady ? <div className="chart-empty">Asignando colores a las nacionalidades…</div> : nationalities.length ? <div className="nationality-visualization"><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={nationalities} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={54} outerRadius={88} paddingAngle={3}>{nationalities.map((item) => <Cell fill={item.color} key={item.name} />)}</Pie><Tooltip formatter={(value, name, item) => [`${value} personas (${Number(item.payload.percentage).toFixed(1)}%)`, name]} /></PieChart></ResponsiveContainer></div><NationalityLegend items={summary.nationalities} colors={nationalityColors} /></div> : <div className="chart-empty">No hay atenciones en este semestre.</div>}</article>
        <article className="surface-card chart-card"><div className="card-heading"><div><h2>Procesos realizados</h2><p>Frecuencia por tipo de proceso.</p></div></div>{processes.length ? <div className="chart-area chart-area--wide"><ResponsiveContainer width="100%" height="100%"><BarChart data={processes} margin={{ top: 10, right: 12, left: -18, bottom: 36 }}><CartesianGrid stroke="#edf0ec" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} tick={{ fontSize: 10, fill: '#667269' }} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#667269' }} /><Tooltip /><Bar dataKey="cantidad" fill="#527e5c" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div> : <div className="chart-empty">No hay atenciones en este semestre.</div>}</article>
      </section>
      <section className="report-tables">
        <article className="surface-card table-card"><div className="card-heading"><div><h2>Clasificación por nacionalidad</h2><p>Personas únicas · porcentaje del total de personas</p></div></div><div className="table-scroll"><table><thead><tr><th>Nacionalidad</th><th>Personas</th><th>Porcentaje</th></tr></thead><tbody>{summary.nationalities.map((row) => <tr key={row.label}><td>{row.label}</td><td>{row.count}</td><td>{row.percentage.toFixed(1)}%</td></tr>)}{!summary.nationalities.length && <tr><td className="table-empty" colSpan={3}>Sin datos para este período.</td></tr>}</tbody></table></div></article>
        <article className="surface-card table-card"><div className="card-heading"><div><h2>Clasificación por proceso</h2><p>Procesos realizados · porcentaje del total de procesos</p></div></div><div className="table-scroll"><table><thead><tr><th>Proceso</th><th>Veces realizado</th><th>Porcentaje</th></tr></thead><tbody>{summary.processes.map((row) => <tr key={row.label}><td><span className="process-pill">{row.label}</span></td><td>{row.count}</td><td>{row.percentage.toFixed(1)}%</td></tr>)}{!summary.processes.length && <tr><td className="table-empty" colSpan={3}>Sin datos para este período.</td></tr>}</tbody></table></div></article>
      </section>
      <div className="surface-card report-share">
        <div><h2>Generar y compartir informe</h2><p>El PDF incluye el resumen, las tablas y gráficos del semestre seleccionado.</p></div>
        <div className="report-share__actions">
          <button className="button button--primary" disabled={distinctCountPending || Boolean(currentDistinctResult?.error) || Boolean(dataError)} onClick={() => void downloadReport()} type="button"><Download size={17} />Descargar PDF</button>
          <button className="button button--secondary" disabled={distinctCountPending || Boolean(currentDistinctResult?.error) || Boolean(dataError)} onClick={() => void shareReport()} type="button"><Share2 size={17} />Compartir PDF</button>
          {!distinctCountPending && !currentDistinctResult?.error && !dataError ? (
            <>
              <a className="button button--ghost" href={`https://wa.me/?text=${message}`} rel="noreferrer" target="_blank"><MessageCircle size={17} />WhatsApp · resumen</a>
              <a className="button button--ghost" href={`mailto:?subject=${encodeURIComponent(`Informe semestral ${year}`)}&body=${message}`}><Mail size={17} />Correo · resumen</a>
            </>
          ) : (
            <>
              <span className="button button--ghost button--disabled" aria-disabled="true"><MessageCircle size={17} />WhatsApp · resumen</span>
              <span className="button button--ghost button--disabled" aria-disabled="true"><Mail size={17} />Correo · resumen</span>
            </>
          )}
        </div>
        {shareError && <p className="form-message form-message--error" role="status">{shareError}</p>}
      </div>
    </div>
  )
}
