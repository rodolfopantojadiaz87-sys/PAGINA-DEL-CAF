import type { CountItem } from '../statistics/aggregates'
import { useI18n } from '../i18n'

interface NationalityLegendProps {
  items: CountItem[]
  colors: Record<string, string>
}

export function NationalityLegend({ items, colors }: NationalityLegendProps) {
  const { t } = useI18n()
  return (
    <ul className="nationality-legend" aria-label={t('Leyenda de nacionalidades')}>
      {items.map((item) => (
        <li key={item.label}>
          <span
            className="nationality-legend__swatch"
            style={{ backgroundColor: colors[item.label] }}
            aria-hidden="true"
          />
          <span className="nationality-legend__label">{item.label}</span>
          <span className="nationality-legend__count">{item.count}</span>
          <span className="nationality-legend__percentage">
            {item.percentage.toFixed(1)}%
          </span>
        </li>
      ))}
    </ul>
  )
}
