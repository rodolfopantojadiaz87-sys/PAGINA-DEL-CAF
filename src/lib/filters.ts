import type { Appointment, PersonWithHistory, ProcessType } from '../types/records'
import { localDate } from './dates'

export type PeriodPreset =
  | 'this-month'
  | 'last-month'
  | 'this-semester'
  | 'last-semester'
  | 'this-year'
  | 'last-year'
  | 'all'
  | 'custom'

export const PERIOD_PRESETS: PeriodPreset[] = [
  'this-month',
  'last-month',
  'this-semester',
  'last-semester',
  'this-year',
  'last-year',
  'all',
  'custom',
]

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  'this-month': 'Este mes',
  'last-month': 'Mes pasado',
  'this-semester': 'Este semestre',
  'last-semester': 'Semestre anterior',
  'this-year': 'Este año',
  'last-year': 'Año pasado',
  all: 'Todo el historial',
  custom: 'Fechas personalizadas',
}

export interface AttendanceFilters {
  period: PeriodPreset
  /** Solo se usan con el periodo personalizado. Formato AAAA-MM-DD. */
  from: string
  to: string
  processes: ProcessType[]
  nationality: string
  collaborator: string
}

export const DEFAULT_FILTERS: AttendanceFilters = {
  period: 'this-semester',
  from: '',
  to: '',
  processes: [],
  nationality: '',
  collaborator: '',
}

export interface DateRange {
  from: string
  to: string
}

function iso(year: number, monthIndex: number, day: number): string {
  return localDate(new Date(year, monthIndex, day))
}

/** Rango de fechas (inclusive) de un periodo; cadenas vacías significan "sin límite". */
export function resolvePeriod(filters: Pick<AttendanceFilters, 'period' | 'from' | 'to'>, today = new Date()): DateRange {
  const year = today.getFullYear()
  const month = today.getMonth()
  const firstSemesterMonth = month < 6 ? 0 : 6
  switch (filters.period) {
    case 'this-month':
      return { from: iso(year, month, 1), to: iso(year, month + 1, 0) }
    case 'last-month':
      return { from: iso(year, month - 1, 1), to: iso(year, month, 0) }
    case 'this-semester':
      return { from: iso(year, firstSemesterMonth, 1), to: iso(year, firstSemesterMonth + 6, 0) }
    case 'last-semester':
      return { from: iso(year, firstSemesterMonth - 6, 1), to: iso(year, firstSemesterMonth, 0) }
    case 'this-year':
      return { from: iso(year, 0, 1), to: iso(year, 11, 31) }
    case 'last-year':
      return { from: iso(year - 1, 0, 1), to: iso(year - 1, 11, 31) }
    case 'all':
      return { from: '', to: '' }
    case 'custom':
      return { from: filters.from, to: filters.to }
  }
}

export function normalizedKey(value: string): string {
  return value.trim().toLocaleLowerCase()
}

/** Atenciones que cumplen todos los filtros. */
export function filterAppointments(
  appointments: Appointment[],
  peopleById: Map<string, PersonWithHistory>,
  filters: AttendanceFilters,
): Appointment[] {
  const { from, to } = resolvePeriod(filters)
  const nationality = normalizedKey(filters.nationality)
  return appointments.filter((appointment) => {
    if (from && appointment.date < from) return false
    if (to && appointment.date > to) return false
    if (filters.processes.length && !filters.processes.includes(appointment.process)) return false
    if (filters.collaborator && appointment.createdBy !== filters.collaborator) return false
    if (nationality) {
      const person = peopleById.get(String(appointment.personId))
      if (!person || normalizedKey(person.nationality) !== nationality) return false
    }
    return true
  })
}

export function countActiveFilters(filters: AttendanceFilters): number {
  return (
    (filters.processes.length ? 1 : 0) +
    (filters.nationality ? 1 : 0) +
    (filters.collaborator ? 1 : 0)
  )
}

/** Nacionalidades distintas (sin repetir por mayúsculas), ordenadas alfabéticamente. */
export function nationalityOptions(people: PersonWithHistory[]): string[] {
  const byKey = new Map<string, string>()
  for (const person of people) {
    const label = person.nationality.trim()
    if (label && !byKey.has(normalizedKey(label))) byKey.set(normalizedKey(label), label)
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b))
}

/** Colaboradores que registraron al menos una atención. */
export function collaboratorOptions(appointments: Appointment[]): { id: string; name: string }[] {
  const byId = new Map<string, string>()
  for (const appointment of appointments) {
    if (appointment.createdBy && !byId.has(appointment.createdBy)) {
      byId.set(appointment.createdBy, appointment.creatorName ?? 'Colaborador')
    }
  }
  return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}
