import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

// Radix Select no admite el valor vacío: se usa un marcador para "todos".
const ALL = '__all__'

interface SelectFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  /** Texto de la opción sin filtro; si se omite no hay opción vacía. */
  allLabel?: string
  disabled?: boolean
  className?: string
  hideLabel?: boolean
  /** Texto que se muestra en la lista cuando no hay opciones que elegir. */
  emptyText?: string
}

export function SelectField({ label, value, onChange, options, allLabel, disabled, className, hideLabel, emptyText }: SelectFieldProps) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label className={cn('text-xs text-muted-foreground', hideLabel && 'sr-only')}>{label}</Label>
      <Select
        disabled={disabled}
        onValueChange={(next) => onChange(next === ALL ? '' : next)}
        value={value === '' && allLabel ? ALL : value}
      >
        <SelectTrigger aria-label={label} className="w-full bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start" position="popper">
          {allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
          {!options.length && emptyText && (
            <p className="max-w-64 px-2 py-1.5 text-xs text-muted-foreground">{emptyText}</p>
          )}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
