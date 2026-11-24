import type { Appointment } from '../types/records'
import { getLocale, useI18n } from '../i18n'
import { formatDate } from '../lib/dates'
import { ProcessTag } from './ProcessTag'

/** Historial de una persona, del más reciente al más antiguo. */
export function HistoryList({ appointments }: { appointments: Appointment[] }) {
  const { language, t } = useI18n()
  if (!appointments.length) {
    return <p className="muted">{t('Todavía no hay atenciones registradas.')}</p>
  }

  return (
    <ol className="timeline">
      {appointments.map((appointment) => (
        <li key={appointment.id ?? `${appointment.personId}-${appointment.date}-${appointment.process}`}>
          <time dateTime={appointment.date}>{formatDate(appointment.date, getLocale(language))}</time>
          <ProcessTag process={appointment.process} />
          {appointment.creatorName && (
            <span className="timeline__who">{t('Atendió: {name}', { name: appointment.creatorName })}</span>
          )}
        </li>
      ))}
    </ol>
  )
}
