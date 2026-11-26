import { CalendarRange, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { getLocale, getProcessLabel, useI18n } from '../i18n'
import {
  DEFAULT_FILTERS,
  PERIOD_LABELS,
  PERIOD_PRESETS,
  countActiveFilters,
  resolvePeriod,
  type AttendanceFilters,
  type PeriodPreset,
} from '../lib/filters'
import { formatDate } from '../lib/dates'
import { processColor } from '../lib/processes'
import { PROCESS_OPTIONS, type ProcessType } from '../types/records'
import { SelectField } from './SelectField'

interface FilterBarProps {
  filters: AttendanceFilters
  onChange: (filters: AttendanceFilters) => void
  nationalities: string[]
  collaborators: { id: string; name: string }[]
}

/** Filtros comunes de Atenciones e Informes. */
export function FilterBar({ filters, onChange, nationalities, collaborators }: FilterBarProps) {
  const { language, t } = useI18n()
  const locale = getLocale(language)
  const range = resolvePeriod(filters)
  const activeCount = countActiveFilters(filters)

  function update(changes: Partial<AttendanceFilters>) {
    onChange({ ...filters, ...changes })
  }

  function changePeriod(period: PeriodPreset) {
    if (period === 'custom') {
      // Al pasar a fechas personalizadas se parte del rango que se estaba viendo.
      update({ period, from: range.from, to: range.to })
    } else {
      update({ period })
    }
  }

  const rangeText = range.from && range.to
    ? t('Del {from} al {to}', { from: formatDate(range.from, locale), to: formatDate(range.to, locale) })
    : range.from
      ? t('Desde el {from}', { from: formatDate(range.from, locale) })
      : range.to
        ? t('Hasta el {to}', { to: formatDate(range.to, locale) })
        : t('Sin límite de fechas')

  return (
    <Card aria-label={t('Filtros')} className="gap-0 py-0 shadow-none" role="region">
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SelectField
            label={t('Periodo rápido')}
            onChange={(value) => changePeriod(value as PeriodPreset)}
            options={PERIOD_PRESETS.map((period) => ({ value: period, label: t(PERIOD_LABELS[period]) }))}
            value={filters.period}
          />
          {/* El rango siempre está a la vista: el periodo solo lo rellena; editarlo pasa a fechas personalizadas. */}
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="filter-from">{t('Desde')}</Label>
            <Input id="filter-from" max={range.to || undefined} onChange={(event) => update({ period: 'custom', from: event.target.value, to: range.to })} type="date" value={range.from} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="filter-to">{t('Hasta')}</Label>
            <Input id="filter-to" min={range.from || undefined} onChange={(event) => update({ period: 'custom', from: range.from, to: event.target.value })} type="date" value={range.to} />
          </div>
          <SelectField
            allLabel={t('Todas')}
            emptyText={t('Aparecen aquí las nacionalidades de las personas registradas.')}
            label={t('Nacionalidad')}
            onChange={(nationality) => update({ nationality })}
            options={nationalities.map((value) => ({ value, label: value }))}
            value={filters.nationality}
          />
          <SelectField
            allLabel={t('Todo el equipo')}
            emptyText={t('Aparece aquí quien haya registrado alguna atención.')}
            label={t('Atendió')}
            onChange={(collaborator) => update({ collaborator })}
            options={collaborators.map(({ id, name }) => ({ value: id, label: name }))}
            value={filters.collaborator}
          />
        </div>

        <ToggleGroup
          aria-label={t('Procesos')}
          className="w-full flex-wrap justify-start"
          onValueChange={(processes) => update({ processes: processes as ProcessType[] })}
          size="sm"
          spacing={2}
          type="multiple"
          value={filters.processes}
          variant="outline"
        >
          {PROCESS_OPTIONS.map((process) => (
            <ToggleGroupItem
              className="gap-1.5 rounded-full data-[state=on]:border-primary data-[state=on]:bg-primary/5 data-[state=on]:text-primary"
              key={process}
              value={process}
            >
              <span aria-hidden="true" className="size-2 rounded-full" style={{ background: processColor(process) }} />
              {getProcessLabel(process, language)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2"><CalendarRange className="size-4" aria-hidden="true" />{rangeText}</span>
          {(activeCount > 0 || filters.period !== DEFAULT_FILTERS.period) && (
            <Button onClick={() => onChange(DEFAULT_FILTERS)} size="sm" variant="ghost">
              <X aria-hidden="true" />
              {t('Quitar filtros')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
