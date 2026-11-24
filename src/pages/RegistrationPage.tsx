import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Check, Pencil, Plus, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { useAuth } from '../auth/useAuth'
import { useWorkspace } from '../auth/useWorkspace'
import { FormAlert } from '../components/FormAlert'
import { PageHeader } from '../components/PageHeader'
import { PersonAvatar } from '../components/PersonAvatar'
import { useAttendanceData } from '../hooks/useAttendanceData'
import { getLocale, getProcessLabel, useI18n } from '../i18n'
import { addDays, formatDate, localDate, relativeDay } from '../lib/dates'
import { nationalityOptions } from '../lib/filters'
import { processColor } from '../lib/processes'
import { searchPeople } from '../lib/search'
import { registerSharedAttendance } from '../services/attendanceService'
import { findPotentialDuplicates } from '../services/personService'
import { PROCESS_OPTIONS, type PersonWithHistory, type ProcessType } from '../types/records'
import { capitalizeWords } from '../utils/textFormatting'

interface RegistrationPageProps {
  selectedPerson?: PersonWithHistory
  initialName?: string
  onOpenPerson: (personId: string) => void
  onRegisterAnother: () => void
}

interface PersonFields {
  name: string
  nationality: string
  phone: string
  email: string
}

const EMPTY_PERSON: PersonFields = { name: '', nationality: '', phone: '', email: '' }

function fieldsOf(person: PersonWithHistory): PersonFields {
  return {
    name: capitalizeWords(person.name),
    nationality: capitalizeWords(person.nationality),
    phone: person.phone,
    email: person.email,
  }
}

export function RegistrationPage({ selectedPerson, initialName, onOpenPerson, onRegisterAnother }: RegistrationPageProps) {
  const { language, t } = useI18n()
  const locale = getLocale(language)
  const { user } = useAuth()
  const { access } = useWorkspace()
  const { people, refresh } = useAttendanceData()

  const [person, setPerson] = useState<PersonWithHistory | undefined>(selectedPerson)
  const [fields, setFields] = useState<PersonFields>(() =>
    selectedPerson ? fieldsOf(selectedPerson) : { ...EMPTY_PERSON, name: capitalizeWords(initialName ?? '') },
  )
  const [editingPerson, setEditingPerson] = useState(false)
  const [process, setProcess] = useState<ProcessType | ''>('')
  const [date, setDate] = useState(localDate())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [duplicate, setDuplicate] = useState<PersonWithHistory>()
  const [saved, setSaved] = useState<{ name: string; personId?: string }>()

  const isAdmin = access.status === 'active' && access.membership.role === 'admin'
  const canEditPerson = Boolean(person && (isAdmin || person.createdBy === user?.id))
  const nationalities = useMemo(() => nationalityOptions(people), [people])
  const today = localDate()
  const yesterday = addDays(today, -1)

  // Mientras se escribe un nombre nuevo, se sugieren personas parecidas ya registradas.
  const similar = useMemo(
    () => (!person && fields.name.trim().length >= 3 ? searchPeople(people, fields.name).slice(0, 3) : []),
    [fields.name, people, person],
  )

  function updateField(field: keyof PersonFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }))
    setError('')
    setDuplicate(undefined)
  }

  function choosePerson(next: PersonWithHistory | undefined) {
    setPerson(next)
    setFields(next ? fieldsOf(next) : EMPTY_PERSON)
    setEditingPerson(false)
    setDuplicate(undefined)
    setError('')
  }

  async function save(personId: string | undefined, details: PersonFields) {
    if (access.status !== 'active') throw new Error('No tienes acceso activo al espacio compartido.')
    await registerSharedAttendance({
      workspaceId: access.membership.workspace_id,
      name: details.name,
      nationality: details.nationality,
      phone: details.phone,
      email: details.email,
      process: process as ProcessType,
      date,
      ...(personId ? { personId } : {}),
    })
    refresh()
    setSaved({ name: details.name, personId })
  }

  async function submit(options: { forceNew?: boolean; useDuplicate?: boolean } = {}) {
    if (!process) {
      setError('Elige el proceso de la atención.')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (options.useDuplicate && duplicate) {
        await save(String(duplicate.id), fieldsOf(duplicate))
      } else if (person) {
        // Sin permiso para editar, se envían los datos guardados tal cual.
        await save(String(person.id), editingPerson && canEditPerson ? fields : fieldsOf(person))
      } else {
        if (!options.forceNew && access.status === 'active') {
          const matches = await findPotentialDuplicates(access.membership.workspace_id, fields)
          if (matches.length) {
            setDuplicate(matches[0])
            return
          }
        }
        await save(undefined, fields)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar la atención.')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="items-center py-10 text-center" role="status">
          <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="size-7" /></span>
          <div className="space-y-1 px-6">
            <h1 className="text-xl font-semibold">{t('Atención guardada')}</h1>
            <p className="text-sm text-muted-foreground">{t('Se añadió al historial de {name}.', { name: saved.name })}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 px-6">
            <Button onClick={onRegisterAnother}><Plus aria-hidden="true" />{t('Registrar otra atención')}</Button>
            {saved.personId && (
              <Button onClick={() => onOpenPerson(saved.personId!)} variant="outline">{t('Ver ficha de {name}', { name: saved.name.split(' ')[0] })}</Button>
            )}
          </div>
        </Card>
      </div>
    )
  }

  const showPersonFields = !person || editingPerson
  const required = <span aria-hidden="true" className="text-destructive" title={t('obligatorio')}>*</span>
  const field = (id: string, label: ReactNode, input: ReactNode, wide = false) => (
    <div className={cn('grid gap-2', wide && 'sm:col-span-2')}>
      <Label htmlFor={id}>{label}</Label>
      {input}
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t('Registrar atención')} description={t('Indica quién vino y qué trámite se hizo.')} />

      <form className="space-y-4" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void submit() }}>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>{t('Persona')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {person && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-3">
                <PersonAvatar className="size-11" name={person.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{person.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{[person.nationality, person.phone, person.email].filter(Boolean).join(', ')}</p>
                  <p className="text-xs text-muted-foreground">
                    {person.lastAppointment
                      ? t('{count} atenciones, la última {date}', { count: person.appointments.length, date: relativeDay(person.lastAppointment.date, locale, t) })
                      : t('Sin atenciones anteriores')}
                  </p>
                </div>
                <div className="flex gap-1">
                  {canEditPerson && !editingPerson && (
                    <Button onClick={() => setEditingPerson(true)} size="sm" type="button" variant="ghost"><Pencil aria-hidden="true" />{t('Editar datos')}</Button>
                  )}
                  <Button onClick={() => choosePerson(undefined)} size="sm" type="button" variant="ghost"><UserRound aria-hidden="true" />{t('Cambiar persona')}</Button>
                </div>
              </div>
            )}

            {showPersonFields && (
              <div className="grid gap-4 sm:grid-cols-2">
                {field('reg-name', <>{t('Nombre completo')} {required}</>, (
                  <Input autoCapitalize="words" autoComplete="off" autoFocus={!person} id="reg-name" maxLength={120} onChange={(event) => updateField('name', capitalizeWords(event.target.value))} placeholder={t('Ej. María González')} required value={fields.name} />
                ), true)}
                {similar.length > 0 && (
                  <div aria-live="polite" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:col-span-2">
                    <p className="text-sm text-amber-900">{t('Ya hay personas con un nombre parecido. ¿Es alguna de ellas?')}</p>
                    <ul className="space-y-1">
                      {similar.map((candidate) => (
                        <li key={candidate.id}>
                          <button className="flex w-full items-center gap-3 rounded-md bg-background px-3 py-2 text-left text-sm shadow-xs transition-colors hover:bg-muted" onClick={() => choosePerson(candidate)} type="button">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{candidate.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">{[candidate.nationality, candidate.phone].filter(Boolean).join(', ')}</span>
                            </span>
                            <span className="shrink-0 text-xs font-medium text-primary">{t('Usar esta persona')}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {field('reg-nationality', <>{t('Nacionalidad')} {required}</>, (
                  <>
                    <Input autoCapitalize="words" id="reg-nationality" list="nationality-options" maxLength={80} onChange={(event) => updateField('nationality', capitalizeWords(event.target.value))} placeholder={t('Ej. Venezuela')} required value={fields.nationality} />
                    <datalist id="nationality-options">{nationalities.map((value) => <option key={value} value={value} />)}</datalist>
                  </>
                ))}
                {field('reg-phone', t('Teléfono'), (
                  <Input autoComplete="off" id="reg-phone" inputMode="tel" maxLength={40} onChange={(event) => updateField('phone', event.target.value)} placeholder="+55 92 99999-9999" type="tel" value={fields.phone} />
                ))}
                {field('reg-email', t('Correo electrónico'), (
                  <Input autoComplete="off" id="reg-email" maxLength={160} onChange={(event) => updateField('email', event.target.value)} placeholder="nombre@correo.com" type="email" value={fields.email} />
                ), true)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>{t('Proceso')} {required}</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              aria-label={t('Proceso')}
              className="grid gap-2 sm:grid-cols-2"
              onValueChange={(value) => { setProcess(value as ProcessType); setError('') }}
              value={process}
            >
              {PROCESS_OPTIONS.map((option) => (
                <Label
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal transition-colors hover:bg-muted/50 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
                  htmlFor={`process-${option}`}
                  key={option}
                >
                  <RadioGroupItem id={`process-${option}`} value={option} />
                  <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: processColor(option) }} />
                  <span>{getProcessLabel(option, language)}</span>
                </Label>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>{t('Fecha de la atención')}</CardTitle>
            <CardDescription>{formatDate(date, locale, 'long')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <ToggleGroup
              onValueChange={(value) => { if (value) setDate(value) }}
              spacing={2}
              type="single"
              value={date === today || date === yesterday ? date : ''}
              variant="outline"
            >
              <ToggleGroupItem className="data-[state=on]:border-primary data-[state=on]:bg-primary/5 data-[state=on]:text-primary" value={today}>{t('Hoy')}</ToggleGroupItem>
              <ToggleGroupItem className="data-[state=on]:border-primary data-[state=on]:bg-primary/5 data-[state=on]:text-primary" value={yesterday}>{t('Ayer')}</ToggleGroupItem>
            </ToggleGroup>
            <Input aria-label={t('Otra fecha')} className="w-auto" max={today} onChange={(event) => setDate(event.target.value)} required type="date" value={date} />
          </CardContent>
        </Card>

        {duplicate && (
          <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="alert">
            <p>
              <strong>{t('{name} ya está en el registro.', { name: duplicate.name })}</strong>{' '}
              {[duplicate.nationality, duplicate.phone, duplicate.email].filter(Boolean).join(', ')}
              {duplicate.lastAppointment && `. ${t('Última visita {date}', { date: formatDate(duplicate.lastAppointment.date, locale) })}`}
            </p>
            <p>{t('¿Es la misma persona?')}</p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={saving} onClick={() => void submit({ useDuplicate: true })} type="button">{t('Sí, añadir a su historial')}</Button>
              <Button disabled={saving} onClick={() => void submit({ forceNew: true })} type="button" variant="outline">{t('No, es otra persona')}</Button>
            </div>
          </div>
        )}

        {error && <FormAlert>{t(error)}</FormAlert>}

        {!duplicate && (
          <div className="flex justify-end">
            <Button className="w-full sm:w-auto" disabled={saving} size="lg" type="submit">
              <Check aria-hidden="true" />{saving ? t('Guardando…') : t('Guardar atención')}
            </Button>
          </div>
        )}
      </form>
    </div>
  )
}
