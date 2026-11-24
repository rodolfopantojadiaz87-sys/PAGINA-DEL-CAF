import type { CSSProperties } from 'react'
import { X } from 'lucide-react'
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

  function toggleProcess(process: ProcessType) {
    update({
      processes: filters.processes.includes(process)
        ? filters.processes.filter((item) => item !== process)
        : [...filters.processes, process],
    })
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
    <section className="filters" aria-label={t('Filtros')}>
      <div className="filters__row">
        <label className="field field--compact">
          <span>{t('Periodo rápido')}</span>
          <select onChange={(event) => changePeriod(event.target.value as PeriodPreset)} value={filters.period}>
            {PERIOD_PRESETS.map((period) => <option key={period} value={period}>{t(PERIOD_LABELS[period])}</option>)}
          </select>
        </label>
        {/* El rango siempre está a la vista: el periodo solo lo rellena; editarlo pasa a fechas personalizadas. */}
        <label className="field field--compact">
          <span>{t('Desde')}</span>
          <input max={range.to || undefined} onChange={(event) => update({ period: 'custom', from: event.target.value, to: range.to })} type="date" value={range.from} />
        </label>
        <label className="field field--compact">
          <span>{t('Hasta')}</span>
          <input min={range.from || undefined} onChange={(event) => update({ period: 'custom', from: range.from, to: event.target.value })} type="date" value={range.to} />
        </label>
        <label className="field field--compact">
          <span>{t('Nacionalidad')}</span>
          <select onChange={(event) => update({ nationality: event.target.value })} value={filters.nationality}>
            <option value="">{t('Todas')}</option>
            {nationalities.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="field field--compact">
          <span>{t('Atendió')}</span>
          <select onChange={(event) => update({ collaborator: event.target.value })} value={filters.collaborator}>
            <option value="">{t('Todo el equipo')}</option>
            {collaborators.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
      </div>
      <div className="filters__processes" role="group" aria-label={t('Procesos')}>
        {PROCESS_OPTIONS.map((process) => {
          const selected = filters.processes.includes(process)
          return (
            <button
              aria-pressed={selected}
              className="chip"
              key={process}
              onClick={() => toggleProcess(process)}
              style={{ '--chip-color': processColor(process) } as CSSProperties}
              type="button"
            >
              <span className="chip__dot" aria-hidden="true" />
              {getProcessLabel(process, language)}
            </button>
          )
        })}
      </div>
      <div className="filters__summary">
        <span>{rangeText}</span>
        {(activeCount > 0 || filters.period !== DEFAULT_FILTERS.period) && (
          <button className="link-button" onClick={() => onChange(DEFAULT_FILTERS)} type="button">
            <X size={14} aria-hidden="true" />
            {t('Quitar filtros')}
          </button>
        )}
      </div>
    </section>
  )
}
