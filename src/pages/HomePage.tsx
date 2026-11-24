import { useMemo, useState } from 'react'
import { ChevronRight, Plus, Search, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '../auth/useAuth'
import { EmptyState } from '../components/EmptyState'
import { FormAlert } from '../components/FormAlert'
import { PersonAvatar } from '../components/PersonAvatar'
import { ProcessTag } from '../components/ProcessTag'
import { StatCard } from '../components/StatCard'
import { useAttendanceData } from '../hooks/useAttendanceData'
import { getLocale, useI18n } from '../i18n'
import { formatDate, localDate, relativeDay } from '../lib/dates'
import { resolvePeriod } from '../lib/filters'
import { searchPeople } from '../lib/search'
import { summarizeAttendances } from '../statistics/aggregates'
import type { PersonWithHistory, Section } from '../types/records'
import type { RegistrationTarget } from '../App'

interface HomePageProps {
  onNavigate: (section: Section) => void
  onOpenPerson: (personId: string) => void
  onRegister: (target: RegistrationTarget) => void
}

/**
 * Recepción: la pantalla responde a lo que pasa en la ventanilla. Llega alguien,
 * se le busca y se registra su atención, o se crea si es la primera vez.
 */
export function HomePage({ onNavigate, onOpenPerson, onRegister }: HomePageProps) {
  const { language, t } = useI18n()
  const locale = getLocale(language)
  const { user } = useAuth()
  const { people, appointments, peopleById, loading, error } = useAttendanceData()
  const [query, setQuery] = useState('')
  const matches = useMemo(() => (query.trim().length >= 2 ? searchPeople(people, query).slice(0, 6) : []), [people, query])

  const today = localDate()
  const month = resolvePeriod({ period: 'this-month', from: '', to: '' })
  const monthAppointments = useMemo(
    () => appointments.filter(({ date }) => date >= month.from && date <= month.to),
    [appointments, month.from, month.to],
  )
  const monthSummary = useMemo(() => summarizeAttendances(monthAppointments, peopleById), [monthAppointments, peopleById])
  const todayCount = appointments.filter(({ date }) => date === today).length
  const recent = useMemo(
    () => [...appointments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
    [appointments],
  )
  const firstName = (typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '').split(' ')[0]

  function registerFor(person: PersonWithHistory) {
    onRegister({ person })
  }

  const figure = (value: number) => (loading ? <Skeleton className="h-9 w-12" /> : value)

  return (
    <div className="space-y-6">
      <section aria-labelledby="reception-title" className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {firstName ? t('Hola, {name}', { name: firstName }) : t('Hola')} · {formatDate(today, locale, 'long')}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl" id="reception-title">{t('¿A quién vas a atender?')}</h1>
        </div>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={t('Buscar persona')}
            autoComplete="off"
            className="h-12 bg-background pl-12 text-base shadow-sm md:text-base"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && matches.length === 1) registerFor(matches[0])
            }}
            placeholder={t('Nombre, teléfono o correo')}
            type="search"
            value={query}
          />
        </div>

        {query.trim().length >= 2 && (
          <Card aria-live="polite" className="gap-0 overflow-hidden py-0">
            {matches.length > 0 && (
              <ul className="divide-y">
                {matches.map((person) => (
                  <li className="flex items-center gap-3 px-3 py-2.5 sm:px-4" key={person.id}>
                    <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onOpenPerson(String(person.id))} type="button">
                      <PersonAvatar name={person.name} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{person.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {person.nationality}
                          {person.lastAppointment
                            ? `, ${t('última visita {date}', { date: relativeDay(person.lastAppointment.date, locale, t) })}`
                            : ''}
                        </span>
                      </span>
                    </button>
                    <Button onClick={() => registerFor(person)} size="sm">
                      <Plus aria-hidden="true" /><span className="hidden sm:inline">{t('Registrar atención')}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <button
              className="flex w-full items-center gap-3 border-t bg-muted/50 px-3 py-3 text-left text-sm transition-colors first:border-t-0 hover:bg-muted sm:px-4"
              onClick={() => onRegister({ name: query.trim() })}
              type="button"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed bg-background"><UserPlus className="size-4" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">{matches.length ? t('¿No es ninguna de estas personas?') : t('No hay nadie registrado con ese nombre.')}</span>
                <span className="block truncate font-medium">{t('Registrar a «{name}» como persona nueva', { name: query.trim() })}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
            </button>
          </Card>
        )}
      </section>

      {error && <FormAlert>{t(error)}</FormAlert>}

      <section aria-label={t('Actividad')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t(todayCount === 1 ? 'atención hoy' : 'atenciones hoy')} value={figure(todayCount)} />
        <StatCard label={t('atenciones este mes')} value={figure(monthSummary.appointmentCount)} />
        <StatCard label={t('personas atendidas este mes')} value={figure(monthSummary.peopleCount)} />
        <StatCard label={t('vinieron por primera vez')} value={figure(monthSummary.newPeopleCount)} />
      </section>

      <Card className="gap-0 shadow-none">
        <CardHeader className="border-b pb-4!">
          <CardTitle>{t('Últimas atenciones')}</CardTitle>
          <CardAction>
            <Button onClick={() => onNavigate('attendances')} size="sm" variant="ghost">{t('Ver todas')}<ChevronRight aria-hidden="true" /></Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          {loading ? (
            <div className="space-y-3 p-6">{[0, 1, 2].map((key) => <Skeleton className="h-10 w-full" key={key} />)}</div>
          ) : recent.length ? (
            <ul className="divide-y">
              {recent.map((appointment) => {
                const person = peopleById.get(String(appointment.personId))
                return (
                  <li key={appointment.id}>
                    <button className="grid w-full grid-cols-[5.5rem_1fr] items-center gap-x-3 gap-y-1 px-6 py-3 text-left transition-colors hover:bg-muted/50 sm:grid-cols-[6.5rem_1fr_auto]" onClick={() => onOpenPerson(String(appointment.personId))} type="button">
                      <span className="text-sm text-muted-foreground">{relativeDay(appointment.date, locale, t)}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{person?.name ?? t('Persona eliminada')}</span>
                        {appointment.creatorName && <span className="block truncate text-xs text-muted-foreground">{t('Atendió: {name}', { name: appointment.creatorName })}</span>}
                      </span>
                      <span className="col-start-2 sm:col-start-auto"><ProcessTag process={appointment.process} /></span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="p-6">
              <EmptyState>{t('Todavía no hay atenciones. Busca o escribe el nombre de la primera persona arriba.')}</EmptyState>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
