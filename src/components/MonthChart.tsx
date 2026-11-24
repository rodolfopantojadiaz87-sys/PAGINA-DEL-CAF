import { getLocale, useI18n } from '../i18n'
import { formatMonth } from '../lib/dates'
import type { MonthItem } from '../statistics/aggregates'

/** Columnas de atenciones por mes. Con muchos meses solo se rotulan algunos. */
export function MonthChart({ months }: { months: MonthItem[] }) {
  const { language, t } = useI18n()
  if (!months.length) return <p className="text-sm text-muted-foreground">{t('No hay atenciones en este periodo.')}</p>

  const locale = getLocale(language)
  const max = Math.max(...months.map(({ count }) => count), 1)
  const labelEvery = months.length > 18 ? 3 : months.length > 9 ? 2 : 1

  return (
    <figure>
      <ol className="flex h-56 items-end gap-1.5 sm:gap-2">
        {months.map(({ month, count }, index) => (
          <li className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" key={month} title={`${formatMonth(month, locale, 'long')}: ${count}`}>
            <span className="text-xs font-medium tabular-nums">{count || ''}</span>
            <span
              className="w-full max-w-24 rounded-t-md bg-primary/85 transition-colors hover:bg-primary"
              style={{ height: `${Math.max((count / max) * 100, count ? 2 : 0)}%` }}
            />
            <span aria-hidden={index % labelEvery !== 0} className="h-4 text-[11px] whitespace-nowrap text-muted-foreground">
              {index % labelEvery === 0 ? formatMonth(month, locale) : ''}
            </span>
          </li>
        ))}
      </ol>
      <figcaption className="sr-only">
        {months.map(({ month, count }) => `${formatMonth(month, locale, 'long')}: ${count}`).join(', ')}
      </figcaption>
    </figure>
  )
}
