import { useMemo, useState } from 'react'
import { Download, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '../components/EmptyState'
import { FormAlert } from '../components/FormAlert'
import { PageHeader } from '../components/PageHeader'
import { PersonAvatar } from '../components/PersonAvatar'
import { SelectField } from '../components/SelectField'
import { useAttendanceData } from '../hooks/useAttendanceData'
import { getLocale, getProcessLabel, useI18n } from '../i18n'
import { downloadCsv } from '../lib/csv'
import { formatDate, localDate, relativeDay } from '../lib/dates'
import { nationalityOptions, normalizedKey } from '../lib/filters'
import { searchPeople } from '../lib/search'
import { PROCESS_OPTIONS } from '../types/records'
import type { RegistrationTarget } from '../App'

type SortOrder = 'recent' | 'name' | 'visits'
const PAGE_SIZE = 50

interface PeoplePageProps {
  onOpenPerson: (personId: string) => void
  onRegister: (target: RegistrationTarget) => void
}

export function PeoplePage({ onOpenPerson, onRegister }: PeoplePageProps) {
  const { language, t } = useI18n()
  const locale = getLocale(language)
  const { people, loading, error } = useAttendanceData()
  const [query, setQuery] = useState('')
  const [nationality, setNationality] = useState('')
  const [process, setProcess] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState<SortOrder>('recent')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const nationalities = useMemo(() => nationalityOptions(people), [people])
  const filtered = useMemo(() => {
    const byNationality = nationality
      ? people.filter((person) => normalizedKey(person.nationality) === normalizedKey(nationality))
      : people
    // Proceso y fechas se aplican juntos: alguna atención de ese proceso dentro del rango.
    const byAttendance = process || from || to
      ? byNationality.filter((person) => person.appointments.some((item) =>
          (!process || item.process === process) &&
          (!from || item.date >= from) &&
          (!to || item.date <= to)))
      : byNationality
    const matched = searchPeople(byAttendance, query)
    // Con búsqueda, el orden lo da la relevancia; sin ella, el orden elegido.
    if (query.trim()) return matched
    return [...matched].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'visits') return b.appointments.length - a.appointments.length || a.name.localeCompare(b.name)
      return (b.lastAppointment?.date ?? '').localeCompare(a.lastAppointment?.date ?? '') || a.name.localeCompare(b.name)
    })
  }, [from, nationality, people, process, query, sort, to])

  const hasFilters = Boolean(query || nationality || process || from || to)

  function exportCsv() {
    downloadCsv(
      `personas-${localDate()}.csv`,
      [t('Nombre'), t('Nacionalidad'), t('Teléfono'), t('Correo'), t('Atenciones'), t('Primera visita'), t('Última visita')],
      filtered.map((person) => [
        person.name,
        person.nationality,
        person.phone,
        person.email,
        person.appointments.length,
        person.appointments.length ? formatDate(person.appointments[person.appointments.length - 1].date, locale) : '',
        person.lastAppointment ? formatDate(person.lastAppointment.date, locale) : '',
      ]),
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Personas')}
        description={loading ? t('Cargando…') : t('{count} personas registradas', { count: people.length })}
        actions={
          <>
            <Button disabled={!filtered.length} onClick={exportCsv} variant="outline"><Download aria-hidden="true" />{t('Exportar CSV')}</Button>
            <Button onClick={() => onRegister({})}><Plus aria-hidden="true" />{t('Persona nueva')}</Button>
          </>
        }
      />
      {error && <FormAlert>{t(error)}</FormAlert>}

      <Card className="gap-4 p-4 shadow-none">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label={t('Buscar')} className="pl-9" onChange={(event) => { setQuery(event.target.value); setVisible(PAGE_SIZE) }} placeholder={t('Buscar por nombre, teléfono o correo')} type="search" value={query} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SelectField allLabel={t('Todas')} emptyText={t('Aparecen aquí las nacionalidades de las personas registradas.')} label={t('Nacionalidad')} onChange={(value) => { setNationality(value); setVisible(PAGE_SIZE) }} options={nationalities.map((value) => ({ value, label: value }))} value={nationality} />
          <SelectField allLabel={t('Cualquier proceso')} label={t('Algún trámite de')} onChange={(value) => { setProcess(value); setVisible(PAGE_SIZE) }} options={PROCESS_OPTIONS.map((item) => ({ value: item, label: getProcessLabel(item, language) }))} value={process} />
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="people-from">{t('Con atención desde')}</Label>
            <Input id="people-from" max={to || undefined} onChange={(event) => { setFrom(event.target.value); setVisible(PAGE_SIZE) }} type="date" value={from} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="people-to">{t('Hasta')}</Label>
            <Input id="people-to" min={from || undefined} onChange={(event) => { setTo(event.target.value); setVisible(PAGE_SIZE) }} type="date" value={to} />
          </div>
          <SelectField
            disabled={Boolean(query.trim())}
            label={t('Ordenar por')}
            onChange={(value) => setSort(value as SortOrder)}
            options={[
              { value: 'recent', label: t('Visita más reciente') },
              { value: 'name', label: t('Nombre') },
              { value: 'visits', label: t('Más atenciones') },
            ]}
            value={sort}
          />
        </div>
      </Card>

      <div className="flex min-h-8 items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{t(filtered.length === 1 ? '{count} persona' : '{count} personas', { count: filtered.length })}</span>
        {hasFilters && (
          <Button onClick={() => { setQuery(''); setNationality(''); setProcess(''); setFrom(''); setTo('') }} size="sm" variant="ghost">
            <X aria-hidden="true" />{t('Quitar filtros')}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((key) => <Skeleton className="h-14 w-full" key={key} />)}</div>
      ) : filtered.length ? (
        <>
          <Card className="gap-0 overflow-hidden py-0 shadow-none">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-4">{t('Persona')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('Contacto')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('Última visita')}</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">{t('Atenciones')}</TableHead>
                  <TableHead className="pr-4"><span className="sr-only">{t('Acciones')}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, visible).map((person) => (
                  <TableRow key={person.id}>
                    <TableCell className="pl-4">
                      <button className="flex items-center gap-3 text-left" onClick={() => onOpenPerson(String(person.id))} type="button">
                        <PersonAvatar name={person.name} />
                        <span className="min-w-0">
                          <span className="block font-medium hover:underline">{person.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {person.nationality}
                            <span className="sm:hidden">{person.lastAppointment ? ` · ${relativeDay(person.lastAppointment.date, locale, t)}` : ''}</span>
                          </span>
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {person.phone && <span className="block">{person.phone}</span>}
                      {person.email && <span className="block">{person.email}</span>}
                      {!person.phone && !person.email && '—'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{person.lastAppointment ? relativeDay(person.lastAppointment.date, locale, t) : '—'}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{person.appointments.length}</TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button aria-label={t('Registrar atención')} onClick={() => onRegister({ person })} size="sm" variant="outline">
                        <Plus aria-hidden="true" /><span className="hidden sm:inline">{t('Atención')}</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          {visible < filtered.length && (
            <Button className="w-full" onClick={() => setVisible((count) => count + PAGE_SIZE)} variant="outline">
              {t('Mostrar {count} más', { count: Math.min(PAGE_SIZE, filtered.length - visible) })}
            </Button>
          )}
        </>
      ) : people.length ? (
        <EmptyState
          action={query.trim() ? (
            <Button onClick={() => onRegister({ name: query.trim() })}>
              <Plus aria-hidden="true" />{t('Registrar a «{name}» como persona nueva', { name: query.trim() })}
            </Button>
          ) : undefined}
        >
          {t('Nadie coincide con la búsqueda o los filtros.')}
        </EmptyState>
      ) : (
        <EmptyState action={<Button onClick={() => onRegister({})}><Plus aria-hidden="true" />{t('Registrar atención')}</Button>}>
          {t('Todavía no hay personas. Aparecen aquí al registrar su primera atención.')}
        </EmptyState>
      )}
    </div>
  )
}
