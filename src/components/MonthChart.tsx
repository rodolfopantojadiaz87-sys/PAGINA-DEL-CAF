import type { CSSProperties } from 'react'
import { getLocale, useI18n } from '../i18n'
import { formatMonth } from '../lib/dates'
import type { MonthItem } from '../statistics/aggregates'

/** Columnas de atenciones por mes. Con muchos meses solo se rotulan algunos. */
export function MonthChart({ months }: { months: MonthItem[] }) {
  const { language, t } = useI18n()
  if (!months.length) return <p className="muted">{t('No hay atenciones en este periodo.')}</p>

  const locale = getLocale(language)
  const max = Math.max(...months.map(({ count }) => count), 1)
  const labelEvery = months.length > 18 ? 3 : months.length > 9 ? 2 : 1

  return (
    <figure className="month-chart">
      <ol className="month-chart__columns" style={{ '--months': months.length } as CSSProperties}>
        {months.map(({ month, count }, index) => (
          <li key={month} title={`${formatMonth(month, locale, 'long')}: ${count}`}>
            <span className="month-chart__value">{count || ''}</span>
            <span className="month-chart__bar" style={{ '--height': `${(count / max) * 100}%` } as CSSProperties} />
            <span className="month-chart__label" aria-hidden={index % labelEvery !== 0}>
              {index % labelEvery === 0 ? formatMonth(month, locale) : ''}
            </span>
          </li>
        ))}
      </ol>
      <figcaption className="visually-hidden">
        {months.map(({ month, count }) => `${formatMonth(month, locale, 'long')}: ${count}`).join(', ')}
      </figcaption>
    </figure>
  )
}
