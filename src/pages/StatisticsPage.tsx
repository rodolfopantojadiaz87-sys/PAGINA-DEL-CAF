import { useMemo } from 'react'
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
import { ChartNoAxesCombined, ClipboardList, UsersRound } from 'lucide-react'
import { NationalityLegend } from '../components/NationalityLegend'
import { SectionTitle } from '../components/SectionTitle'
import { useAttendanceData } from '../hooks/useAttendanceData'
import { useNationalityColors } from '../hooks/useNationalityColors'
import { colorsForNationalities } from '../services/nationalityColors'
import { createAllTimeSummary } from '../statistics/aggregates'

export function StatisticsPage() {
  const { people, appointments, error } = useAttendanceData()
  const summary = useMemo(() => createAllTimeSummary(people, appointments), [people, appointments])
  const { colors: savedColors, error: colorError, ready: colorsReady } = useNationalityColors(
    summary.nationalities.map(({ label }) => label),
  )
  const nationalityColors = colorsForNationalities(summary.nationalities, savedColors)
  const nationalities = summary.nationalities.map((item) => ({
    name: item.label,
    value: item.count,
    percentage: item.percentage,
    color: nationalityColors[item.label],
  }))
  const processes = summary.processes.map(({ label, count }) => ({ name: label, cantidad: count }))

  return (
    <div className="page-stack">
      <SectionTitle eyebrow="ACTIVIDAD" title="Estadísticas" description="Datos actualizados automáticamente a partir de tus registros." />
      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      {colorError && <p className="form-message form-message--error" role="alert">{colorError}</p>}
      <section className="stats-grid" aria-label="Estadísticas generales">
        <article className="metric-card"><div className="metric-card__top"><span className="metric-card__icon metric-card__icon--green"><UsersRound size={19} /></span><span className="metric-card__trend">Total</span></div><p>Personas distintas</p><strong>{summary.peopleCount}</strong><small>Sin contar visitas repetidas</small></article>
        <article className="metric-card"><div className="metric-card__top"><span className="metric-card__icon metric-card__icon--blue"><ClipboardList size={19} /></span><span className="metric-card__trend">Total</span></div><p>Atenciones realizadas</p><strong>{summary.appointmentCount}</strong><small>Visitas guardadas</small></article>
        <article className="metric-card"><div className="metric-card__top"><span className="metric-card__icon metric-card__icon--amber"><ChartNoAxesCombined size={19} /></span><span className="metric-card__trend">Total</span></div><p>Procesos realizados</p><strong>{summary.processCount}</strong><small>Un proceso por atención</small></article>
      </section>
      <section className="charts-grid">
        <article className="surface-card chart-card">
          <div className="card-heading"><div><h2>Personas por nacionalidad</h2><p>Cada persona se cuenta una sola vez.</p></div></div>
          {nationalities.length && !colorsReady ? <div className="chart-empty">Asignando colores a las nacionalidades…</div> : nationalities.length ? <div className="nationality-visualization"><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={nationalities} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={92} paddingAngle={3}>{nationalities.map((entry) => <Cell fill={entry.color} key={entry.name} />)}</Pie><Tooltip formatter={(value, name, item) => [`${value} personas (${Number(item.payload.percentage).toFixed(1)}%)`, name]} /></PieChart></ResponsiveContainer></div><NationalityLegend items={summary.nationalities} colors={nationalityColors} /></div> : <div className="chart-empty">Registra personas para ver este gráfico.</div>}
        </article>
        <article className="surface-card chart-card">
          <div className="card-heading"><div><h2>Procesos realizados</h2><p>Cantidad de atenciones por categoría.</p></div></div>
          {processes.length ? <div className="chart-area chart-area--wide"><ResponsiveContainer width="100%" height="100%"><BarChart data={processes} margin={{ top: 10, right: 12, left: -18, bottom: 36 }}><CartesianGrid stroke="#edf0ec" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} tick={{ fontSize: 10, fill: '#667269' }} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#667269' }} /><Tooltip /><Bar dataKey="cantidad" fill="#527e5c" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div> : <div className="chart-empty">Registra atenciones para ver este gráfico.</div>}
        </article>
      </section>
    </div>
  )
}
