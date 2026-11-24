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
  if (!items.length) return <p className="text-sm text-muted-foreground">{emptyText}</p>

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
    <ul className="space-y-3">
      {rows.map((item) => (
        <li className="space-y-1.5" key={item.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{label ? label(item) : item.label}</span>
            <span className="shrink-0 tabular-nums">
              <strong className="font-semibold">{item.count}</strong>
              <span className="ml-2 text-xs text-muted-foreground">{item.percentage.toFixed(1)}%</span>
            </span>
          </div>
          <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${(item.count / max) * 100}%`, background: color?.(item) ?? 'var(--primary)' }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
