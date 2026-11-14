import { CalendarDays, ClipboardList } from 'lucide-react'
import type { Appointment } from '../types/records'

interface HistoryListProps {
  appointments: Appointment[]
}

export function HistoryList({ appointments }: HistoryListProps) {
  if (!appointments.length) {
    return <p className="muted">Todavía no hay atenciones registradas.</p>
  }

  return (
    <ul className="history-list">
      {appointments.map((appointment) => (
        <li key={appointment.id ?? `${appointment.personId}-${appointment.date}-${appointment.process}`}>
          <span className="history-list__icon"><ClipboardList size={17} /></span>
          <span className="history-list__process">
            {appointment.process}
            {appointment.creatorName && <small className="history-list__creator">Atendió: {appointment.creatorName}</small>}
          </span>
          <span className="history-list__date">
            <CalendarDays size={14} />
            {new Date(`${appointment.date}T12:00:00`).toLocaleDateString('es')}
          </span>
        </li>
      ))}
    </ul>
  )
}
