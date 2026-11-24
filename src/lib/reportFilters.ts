import { getLocale, getProcessLabel, translateText, type Language } from '../i18n'
import { formatDate } from './dates'
import { PERIOD_LABELS, resolvePeriod, type AttendanceFilters } from './filters'

/** Texto del periodo para cabeceras: "Este semestre: del 01/07/2026 al 31/12/2026". */
export function describePeriod(filters: AttendanceFilters, language: Language): string {
  const tr = (text: string, values?: Record<string, string>) => translateText(text, language, values)
  const locale = getLocale(language)
  const { from, to } = resolvePeriod(filters)
  const range = from && to
    ? tr('del {from} al {to}', { from: formatDate(from, locale), to: formatDate(to, locale) })
    : from
      ? tr('desde el {from}', { from: formatDate(from, locale) })
      : to
        ? tr('hasta el {to}', { to: formatDate(to, locale) })
        : tr('sin límite de fechas')
  return filters.period === 'custom' ? range.charAt(0).toLocaleUpperCase() + range.slice(1) : `${tr(PERIOD_LABELS[filters.period])}: ${range}`
}

/** Filtros además del periodo, uno por línea, ya traducidos. */
export function describeFilters(
  filters: AttendanceFilters,
  collaborators: { id: string; name: string }[],
  language: Language,
): string[] {
  const tr = (text: string) => translateText(text, language)
  const lines: string[] = []
  if (filters.processes.length) {
    lines.push(`${tr('Proceso')}: ${filters.processes.map((process) => getProcessLabel(process, language)).join(', ')}`)
  }
  if (filters.nationality) lines.push(`${tr('Nacionalidad')}: ${filters.nationality}`)
  if (filters.collaborator) {
    const name = collaborators.find(({ id }) => id === filters.collaborator)?.name ?? filters.collaborator
    lines.push(`${tr('Atendió')}: ${name}`)
  }
  return lines
}

/** Sufijo de archivo según el rango: "2026-07-01_2026-12-31". */
export function fileSuffix(filters: AttendanceFilters): string {
  const { from, to } = resolvePeriod(filters)
  return from || to ? `${from || 'inicio'}_${to || 'hoy'}` : 'todo'
}
