import {
  ArrowDownRight,
  ArrowRight,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  Plus,
  UsersRound,
} from 'lucide-react'
import { useAttendanceData } from '../hooks/useAttendanceData'
import { createAllTimeSummary } from '../statistics/aggregates'
import type { Section } from '../types/records'
import { SectionTitle } from '../components/SectionTitle'

interface DashboardPageProps {
  onNavigate: (section: Section) => void
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { people, appointments, loading, error } = useAttendanceData()
  const summary = createAllTimeSummary(people, appointments)
  const latest = [...appointments]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)

  return (
    <div className="page-stack">
      <SectionTitle
        eyebrow="RESUMEN GENERAL"
        title="Inicio"
        description="Un vistazo rápido a las personas y atenciones registradas."
        action={
          <button className="button button--primary" onClick={() => onNavigate('new')} type="button">
            <Plus size={18} /> Nuevo registro
          </button>
        }
      />
      {error && <p className="form-message form-message--error" role="alert">{error}</p>}

      <section className="welcome-banner">
        <div className="welcome-banner__content">
          <p>Tu espacio de trabajo</p>
          <h2>Organiza cada atención, con cuidado y claridad.</h2>
          <button className="text-button text-button--light" onClick={() => onNavigate('search')} type="button">
            Buscar una persona <ArrowRight size={16} />
          </button>
        </div>
        <div className="welcome-banner__decoration" aria-hidden="true">
          <span><UsersRound size={36} /></span>
          <span><ClipboardList size={28} /></span>
        </div>
      </section>

      <section className="stats-grid" aria-label="Resumen de registros">
        <article className="metric-card">
          <div className="metric-card__top"><span className="metric-card__icon metric-card__icon--green"><UsersRound size={19} /></span><span className="metric-card__trend"><ArrowDownRight size={15} /> Acumulado</span></div>
          <p>Personas distintas</p>
          <strong>{summary.peopleCount}</strong>
          <small>Personas atendidas</small>
        </article>
        <article className="metric-card">
          <div className="metric-card__top"><span className="metric-card__icon metric-card__icon--blue"><CalendarDays size={19} /></span><span className="metric-card__trend">Historial</span></div>
          <p>Total de atenciones</p>
          <strong>{summary.appointmentCount}</strong>
          <small>Visitas registradas</small>
        </article>
        <article className="metric-card">
          <div className="metric-card__top"><span className="metric-card__icon metric-card__icon--amber"><ChartNoAxesCombined size={19} /></span><span className="metric-card__trend">Acumulado</span></div>
          <p>Procesos realizados</p>
          <strong>{summary.processCount}</strong>
          <small>Servicios realizados</small>
        </article>
      </section>

      <section className="content-grid">
        <article className="surface-card recent-card">
          <div className="card-heading">
            <div><h2>Atenciones recientes</h2><p>Los últimos procesos registrados</p></div>
            <button className="text-button" onClick={() => onNavigate('people')} type="button">Ver personas <ArrowRight size={15} /></button>
          </div>
          {loading ? (
            <div className="empty-state"><strong>Cargando datos compartidos…</strong></div>
          ) : latest.length ? (
            <div className="table-scroll">
              <table>
                <thead><tr><th>Proceso</th><th>Fecha</th><th>Persona</th></tr></thead>
                <tbody>
                  {latest.map((appointment) => {
                    const person = people.find(({ id }) => id === appointment.personId)
                    return <tr key={appointment.id}><td><span className="process-pill">{appointment.process}</span></td><td>{new Date(`${appointment.date}T12:00:00`).toLocaleDateString('es')}</td><td>{person?.name ?? 'Persona eliminada'}</td></tr>
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state"><span className="empty-state__icon"><ClipboardList size={22} /></span><strong>Aún no hay atenciones</strong><p>Al guardar tu primer registro, aparecerá aquí.</p><button className="button button--secondary" onClick={() => onNavigate('new')} type="button">Crear registro</button></div>
          )}
        </article>
        <aside className="surface-card shortcuts-card">
          <div className="card-heading"><div><h2>Accesos rápidos</h2><p>Continúa con una tarea</p></div></div>
          <button className="shortcut" onClick={() => onNavigate('new')} type="button"><span className="shortcut__icon shortcut__icon--green"><Plus size={19} /></span><span><strong>Registrar atención</strong><small>Guardar una nueva visita</small></span><ArrowRight size={16} /></button>
          <button className="shortcut" onClick={() => onNavigate('search')} type="button"><span className="shortcut__icon shortcut__icon--blue"><UsersRound size={19} /></span><span><strong>Buscar persona</strong><small>Consultar datos e historial</small></span><ArrowRight size={16} /></button>
          <button className="shortcut" onClick={() => onNavigate('statistics')} type="button"><span className="shortcut__icon shortcut__icon--amber"><ChartNoAxesCombined size={19} /></span><span><strong>Ver estadísticas</strong><small>Revisar el resumen de actividad</small></span><ArrowRight size={16} /></button>
        </aside>
      </section>
    </div>
  )
}
