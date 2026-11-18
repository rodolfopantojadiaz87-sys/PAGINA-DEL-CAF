import { CalendarDays, ClipboardList } from 'lucide-react'
import type { Appointment } from '../types/records'
import { getLocale, getProcessLabel, useI18n } from '../i18n'

interface HistoryListProps {
  appointments: Appointment[]
}

export function HistoryList({ appointments }: HistoryListProps) {
  const { language, t } = useI18n()
  if (!appointments.length) {
    return <p className="muted">{t('Todavía no hay atenciones registradas.')}</p>
  }

  return (
    <ul className="history-list">
      {appointments.map((appointment) => (
        <li key={appointment.id ?? `${appointment.personId}-${appointment.date}-${appointment.process}`}>
          <span className="history-list__icon"><ClipboardList size={17} /></span>
          <span className="history-list__process">
            {getProcessLabel(appointment.process, language)}
            {appointment.creatorName && <small className="history-list__creator">{t('Atendió: {name}', { name: appointment.creatorName })}</small>}
          </span>
          <span className="history-list__date">
            <CalendarDays size={14} />
            {new Date(`${appointment.date}T12:00:00`).toLocaleDateString(getLocale(language))}
          </span>
        </li>
      ))}
    </ul>
  )
}
