import type { Appointment, PersonWithHistory } from '../types/records'

export interface CountItem {
  label: string
  count: number
  percentage: number
}

export interface MonthItem {
  /** AAAA-MM */
  month: string
  count: number
}

export interface AttendanceSummary {
  /** Personas distintas atendidas en el conjunto. */
  peopleCount: number
  /** Personas cuya primera atención registrada cae dentro del conjunto. */
  newPeopleCount: number
  appointmentCount: number
  /** Personas distintas por nacionalidad. */
  nationalities: CountItem[]
  /** Atenciones por proceso. */
  processes: CountItem[]
  /** Atenciones por colaborador. */
  collaborators: CountItem[]
  /** Atenciones por mes, en orden cronológico y sin huecos. */
  months: MonthItem[]
}

export function getSemesterRange(
  year: number,
  semester: 1 | 2,
): { start: string; end: string } {
  return semester === 1
    ? { start: `${year}-01-01`, end: `${year}-06-30` }
    : { start: `${year}-07-01`, end: `${year}-12-31` }
}

function toItems(counts: Map<string, { label: string; count: number }>, total: number): CountItem[] {
  return [...counts.values()]
    .map(({ label, count }) => ({
      label,
      count,
      percentage: total ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function increment(counts: Map<string, { label: string; count: number }>, key: string, label: string) {
  const existing = counts.get(key)
  if (existing) existing.count += 1
  else counts.set(key, { label, count: 1 })
}

function monthsBetween(first: string, last: string): string[] {
  const months: string[] = []
  let [year, month] = first.split('-').map(Number)
  const [lastYear, lastMonth] = last.split('-').map(Number)
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`)
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return months
}

/**
 * Resume un conjunto de atenciones (normalmente ya filtrado).
 * Las personas se cuentan una sola vez; las atenciones y procesos, una por visita.
 */
export function summarizeAttendances(
  appointments: Appointment[],
  peopleById: Map<string, PersonWithHistory>,
  /** Si el periodo tiene inicio y fin, se muestran todos sus meses, aunque estén vacíos. */
  range?: { from: string; to: string },
): AttendanceSummary {
  const personIds = new Set(appointments.map(({ personId }) => String(personId)))
  const ids = new Set(appointments.map((appointment) => String(appointment.id)))

  const nationalities = new Map<string, { label: string; count: number }>()
  let newPeopleCount = 0
  for (const personId of personIds) {
    const person = peopleById.get(personId)
    const label = person?.nationality.trim() || 'Sin especificar'
    increment(nationalities, label.toLocaleLowerCase(), label)
    // El historial está ordenado de más reciente a más antiguo: la primera visita es la última.
    const firstVisit = person?.appointments[person.appointments.length - 1]
    if (firstVisit && ids.has(String(firstVisit.id))) newPeopleCount += 1
  }

  const processes = new Map<string, { label: string; count: number }>()
  const collaborators = new Map<string, { label: string; count: number }>()
  const monthCounts = new Map<string, number>()
  for (const appointment of appointments) {
    increment(processes, appointment.process, appointment.process)
    increment(
      collaborators,
      appointment.createdBy ?? 'sin-registro',
      appointment.creatorName ?? 'Sin registro',
    )
    const month = appointment.date.slice(0, 7)
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1)
  }

  const sortedMonths = [...monthCounts.keys()].sort()
  const first = range?.from && range.to ? range.from.slice(0, 7) : sortedMonths[0]
  const last = range?.from && range.to ? range.to.slice(0, 7) : sortedMonths[sortedMonths.length - 1]
  const months = first && last
    ? monthsBetween(first, last).map((month) => ({
        month,
        count: monthCounts.get(month) ?? 0,
      }))
    : []

  return {
    peopleCount: personIds.size,
    newPeopleCount,
    appointmentCount: appointments.length,
    nationalities: toItems(nationalities, personIds.size),
    processes: toItems(processes, appointments.length),
    collaborators: toItems(collaborators, appointments.length),
    months,
  }
}
