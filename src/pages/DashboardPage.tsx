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
import { getLocale, getProcessLabel, useI18n } from '../i18n'

interface DashboardPageProps {
  onNavigate: (section: Section) => void
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { language, t } = useI18n()
  const { people, appointments, loading, error } = useAttendanceData()
  const summary = createAllTimeSummary(people, appointments)
  const latest = [...appointments]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)

  return (
    <div className="page-stack">
      <SectionTitle
        eyebrow={t('RESUMEN GENERAL')}
        title={t('Inicio')}
        description={t('Un vistazo rápido a las personas y atenciones registradas.')}
        action={
          <button className="button button--primary" onClick={() => onNavigate('new')} type="button">
            <Plus size={18} /> {t('Nuevo registro')}
          </button>
        }
      />
      {error && <p className="form-message form-message--error" role="alert">{t(error)}</p>}

      <section className="welcome-banner">
        <div className="welcome-banner__content">
          <p>{t('Tu espacio de trabajo')}</p>
          <h2>{t('Organiza cada atención, con cuidado y claridad.')}</h2>
          <button className="text-button text-button--light" onClick={() => onNavigate('search')} type="button">
            {t('Buscar una persona')} <ArrowRight size={16} />
          </button>
        </div>
        <div className="welcome-banner__decoration" aria-hidden="true">
          <span><UsersRound size={36} /></span>
          <span><ClipboardList size={28} /></span>
        </div>
      </section>

      <section className="stats-grid" aria-label={t('Resumen de registros')}>
        <article className="metric-card">
          <div className="metric-card__top"><span className="metric-card__icon metric-card__icon--green"><UsersRound size={19} /></span><span className="metric-card__trend"><ArrowDownRight size={15} /> {t('Acumulado')}</span></div>
          <p>{t('Personas distintas')}</p>
          <strong>{summary.peopleCount}</strong>
          <small>{t('Personas atendidas')}</small>
        </article>
        <article className="metric-card">
          <div className="metric-card__top"><span className="metric-card__icon metric-card__icon--blue"><CalendarDays size={19} /></span><span className="metric-card__trend">{t('Historial')}</span></div>
          <p>{t('Total de atenciones')}</p>
          <strong>{summary.appointmentCount}</strong>
          <small>{t('Visitas registradas')}</small>
        </article>
        <article className="metric-card">
          <div className="metric-card__top"><span className="metric-card__icon metric-card__icon--amber"><ChartNoAxesCombined size={19} /></span><span className="metric-card__trend">{t('Acumulado')}</span></div>
          <p>{t('Procesos realizados')}</p>
          <strong>{summary.processCount}</strong>
          <small>{t('Servicios realizados')}</small>
        </article>
      </section>

      <section className="content-grid">
        <article className="surface-card recent-card">
          <div className="card-heading">
            <div><h2>{t('Atenciones recientes')}</h2><p>{t('Los últimos procesos registrados')}</p></div>
            <button className="text-button" onClick={() => onNavigate('people')} type="button">{t('Ver personas')} <ArrowRight size={15} /></button>
          </div>
          {loading ? (
            <div className="empty-state"><strong>{t('Cargando datos compartidos…')}</strong></div>
          ) : latest.length ? (
            <div className="table-scroll">
              <table>
                <thead><tr><th>{t('Proceso')}</th><th>{t('Fecha')}</th><th>{t('Persona')}</th></tr></thead>
                <tbody>
                  {latest.map((appointment) => {
                    const person = people.find(({ id }) => id === appointment.personId)
                    return <tr key={appointment.id}><td><span className="process-pill">{getProcessLabel(appointment.process, language)}</span></td><td>{new Date(`${appointment.date}T12:00:00`).toLocaleDateString(getLocale(language))}</td><td>{person?.name ?? t('Persona eliminada')}</td></tr>
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state"><span className="empty-state__icon"><ClipboardList size={22} /></span><strong>{t('Aún no hay atenciones')}</strong><p>{t('Al guardar tu primer registro, aparecerá aquí.')}</p><button className="button button--secondary" onClick={() => onNavigate('new')} type="button">{t('Crear registro')}</button></div>
          )}
        </article>
        <aside className="surface-card shortcuts-card">
          <div className="card-heading"><div><h2>{t('Accesos rápidos')}</h2><p>{t('Continúa con una tarea')}</p></div></div>
          <button className="shortcut" onClick={() => onNavigate('new')} type="button"><span className="shortcut__icon shortcut__icon--green"><Plus size={19} /></span><span><strong>{t('Registrar atención')}</strong><small>{t('Guardar una nueva visita')}</small></span><ArrowRight size={16} /></button>
          <button className="shortcut" onClick={() => onNavigate('search')} type="button"><span className="shortcut__icon shortcut__icon--blue"><UsersRound size={19} /></span><span><strong>{t('Buscar persona')}</strong><small>{t('Consultar datos e historial')}</small></span><ArrowRight size={16} /></button>
          <button className="shortcut" onClick={() => onNavigate('reports')} type="button"><span className="shortcut__icon shortcut__icon--amber"><ChartNoAxesCombined size={19} /></span><span><strong>{t('Ver estadísticas e informes')}</strong><small>{t('Revisar el resumen de actividad')}</small></span><ArrowRight size={16} /></button>
        </aside>
      </section>
    </div>
  )
}
