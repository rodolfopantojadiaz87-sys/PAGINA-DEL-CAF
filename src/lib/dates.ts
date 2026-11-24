import type { Appointment } from '../types/records'

/** Fecha local en formato AAAA-MM-DD (sin desplazamiento por zona horaria). */
export function localDate(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return localDate(new Date(year, month - 1, day + days))
}

/** Convierte AAAA-MM-DD en Date al mediodía local, para que no cambie de día al formatear. */
function toDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`)
}

export function formatDate(isoDate: string, locale: string, style: 'short' | 'long' = 'short'): string {
  return toDate(isoDate).toLocaleDateString(
    locale,
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : { day: '2-digit', month: '2-digit', year: 'numeric' },
  )
}

export function formatMonth(month: string, locale: string, style: 'short' | 'long' = 'short'): string {
  return toDate(`${month}-15`).toLocaleDateString(
    locale,
    style === 'long' ? { month: 'long', year: 'numeric' } : { month: 'short', year: '2-digit' },
  )
}

/** "Hoy", "Ayer" o la fecha corta, para listas recientes. */
export function relativeDay(isoDate: string, locale: string, t: (text: string) => string): string {
  const today = localDate()
  if (isoDate === today) return t('Hoy')
  if (isoDate === addDays(today, -1)) return t('Ayer')
  return formatDate(isoDate, locale)
}

export function sortHistory(history: Appointment[]): Appointment[] {
  return [...history].sort(
    (a, b) => b.date.localeCompare(a.date) || String(b.id ?? '').localeCompare(String(a.id ?? '')),
  )
}
