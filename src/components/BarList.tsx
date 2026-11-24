import type { CSSProperties } from 'react'
import type { CountItem } from '../statistics/aggregates'

interface BarListProps {
  items: CountItem[]
  /** Texto visible de cada fila (por ejemplo, la etiqueta traducida del proceso). */
  label?: (item: CountItem) => string
  color?: (item: CountItem) => string
  emptyText: string
  /** Máximo de filas visibles; el resto se agrupa en "Otros". */
  limit?: number
  otherLabel?: string
}

/** Barras horizontales con etiqueta, cantidad y porcentaje: legibles en pantalla y fáciles de comparar. */
export function BarList({ items, label, color, emptyText, limit, otherLabel = 'Otros' }: BarListProps) {
  if (!items.length) return <p className="muted">{emptyText}</p>

  let rows = items
  if (limit && items.length > limit) {
    const rest = items.slice(limit - 1)
    rows = [
      ...items.slice(0, limit - 1),
      {
        label: otherLabel,
        count: rest.reduce((sum, item) => sum + item.count, 0),
        percentage: rest.reduce((sum, item) => sum + item.percentage, 0),
      },
    ]
  }
  const max = Math.max(...rows.map((item) => item.count), 1)

  return (
    <ul className="bar-list">
      {rows.map((item) => (
        <li
          key={item.label}
          style={{ '--bar': `${(item.count / max) * 100}%`, '--bar-color': color?.(item) ?? 'var(--navy)' } as CSSProperties}
        >
          <span className="bar-list__label">{label ? label(item) : item.label}</span>
          <span className="bar-list__value">
            <strong>{item.count}</strong>
            <small>{item.percentage.toFixed(1)}%</small>
          </span>
          <span className="bar-list__track" aria-hidden="true"><span /></span>
        </li>
      ))}
    </ul>
  )
}
