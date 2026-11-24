import type { Appointment } from '../types/records'
import { getLocale, useI18n } from '../i18n'
import { formatDate } from '../lib/dates'
import { processColor } from '../lib/processes'
import { ProcessTag } from './ProcessTag'

/** Historial de una persona, del más reciente al más antiguo. */
export function HistoryList({ appointments }: { appointments: Appointment[] }) {
  const { language, t } = useI18n()
  if (!appointments.length) {
    return <p className="text-sm text-muted-foreground">{t('Todavía no hay atenciones registradas.')}</p>
  }

  return (
    <ol className="relative space-y-4 border-l pl-5">
      {appointments.map((appointment) => (
        <li className="relative" key={appointment.id ?? `${appointment.personId}-${appointment.date}-${appointment.process}`}>
          <span aria-hidden="true" className="absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4 ring-background" style={{ background: processColor(appointment.process) }} />
          <div className="flex flex-wrap items-center gap-2">
            <time className="text-sm font-medium" dateTime={appointment.date}>{formatDate(appointment.date, getLocale(language))}</time>
            <ProcessTag process={appointment.process} />
          </div>
          {appointment.creatorName && (
            <p className="mt-0.5 text-xs text-muted-foreground">{t('Atendió: {name}', { name: appointment.creatorName })}</p>
          )}
        </li>
      ))}
    </ol>
  )
}
