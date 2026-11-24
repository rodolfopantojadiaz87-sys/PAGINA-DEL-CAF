import { useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { Check, Pencil, Plus, UserRound } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { useWorkspace } from '../auth/useWorkspace'
import { PageHeader } from '../components/PageHeader'
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
      <div className="page page--narrow">
        <section className="done" role="status">
          <span className="done__icon" aria-hidden="true"><Check size={28} /></span>
          <h1>{t('Atención guardada')}</h1>
          <p>{t('Se añadió al historial de {name}.', { name: saved.name })}</p>
          <div className="button-row">
            <button className="button button--primary" onClick={onRegisterAnother} type="button"><Plus size={17} aria-hidden="true" />{t('Registrar otra atención')}</button>
            {saved.personId && (
              <button className="button button--secondary" onClick={() => onOpenPerson(saved.personId!)} type="button">{t('Ver ficha de {name}', { name: saved.name.split(' ')[0] })}</button>
            )}
          </div>
        </section>
      </div>
    )
  }

  const showPersonFields = !person || editingPerson

  return (
    <div className="page page--narrow">
      <PageHeader title={t('Registrar atención')} description={t('Indica quién vino y qué trámite se hizo.')} />

      <form className="form" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void submit() }}>
        <fieldset className="form__group">
          <legend>{t('Persona')}</legend>

          {person && (
            <div className="person-card">
              <span className="avatar avatar--large" aria-hidden="true">{person.name.slice(0, 1).toLocaleUpperCase()}</span>
              <div className="person-card__text">
                <strong>{person.name}</strong>
                <span>{[person.nationality, person.phone, person.email].filter(Boolean).join(', ')}</span>
                <small>
                  {person.lastAppointment
                    ? t('{count} atenciones, la última {date}', { count: person.appointments.length, date: relativeDay(person.lastAppointment.date, locale, t) })
                    : t('Sin atenciones anteriores')}
                </small>
              </div>
              <div className="person-card__actions">
                {canEditPerson && !editingPerson && (
                  <button className="button button--quiet button--small" onClick={() => setEditingPerson(true)} type="button"><Pencil size={14} aria-hidden="true" />{t('Editar datos')}</button>
                )}
                <button className="button button--quiet button--small" onClick={() => choosePerson(undefined)} type="button"><UserRound size={14} aria-hidden="true" />{t('Cambiar persona')}</button>
              </div>
            </div>
          )}

          {showPersonFields && (
            <div className="form__grid">
              <label className="field field--wide">
                <span>{t('Nombre completo')} <abbr title={t('obligatorio')}>*</abbr></span>
                <input autoCapitalize="words" autoComplete="off" autoFocus={!person} maxLength={120} onChange={(event) => updateField('name', capitalizeWords(event.target.value))} placeholder={t('Ej. María González')} required value={fields.name} />
              </label>
              {similar.length > 0 && (
                <div className="similar field--wide" aria-live="polite">
                  <p>{t('Ya hay personas con un nombre parecido. ¿Es alguna de ellas?')}</p>
                  <ul>
                    {similar.map((candidate) => (
                      <li key={candidate.id}>
                        <button className="similar__option" onClick={() => choosePerson(candidate)} type="button">
                          <strong>{candidate.name}</strong>
                          <span>{[candidate.nationality, candidate.phone].filter(Boolean).join(', ')}</span>
                          <em>{t('Usar esta persona')}</em>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <label className="field">
                <span>{t('Nacionalidad')} <abbr title={t('obligatorio')}>*</abbr></span>
                <input autoCapitalize="words" list="nationality-options" maxLength={80} onChange={(event) => updateField('nationality', capitalizeWords(event.target.value))} placeholder={t('Ej. Venezuela')} required value={fields.nationality} />
                <datalist id="nationality-options">{nationalities.map((value) => <option key={value} value={value} />)}</datalist>
              </label>
              <label className="field">
                <span>{t('Teléfono')}</span>
                <input autoComplete="off" inputMode="tel" maxLength={40} onChange={(event) => updateField('phone', event.target.value)} placeholder="+55 92 99999-9999" type="tel" value={fields.phone} />
              </label>
              <label className="field field--wide">
                <span>{t('Correo electrónico')}</span>
                <input autoComplete="off" maxLength={160} onChange={(event) => updateField('email', event.target.value)} placeholder="nombre@correo.com" type="email" value={fields.email} />
              </label>
            </div>
          )}
        </fieldset>

        <fieldset className="form__group">
          <legend>{t('Proceso')} <abbr title={t('obligatorio')}>*</abbr></legend>
          <div className="process-picker">
            {PROCESS_OPTIONS.map((option) => (
              <label className="process-option" key={option} style={{ '--process-color': processColor(option) } as CSSProperties}>
                <input checked={process === option} name="process" onChange={() => { setProcess(option); setError('') }} type="radio" value={option} />
                <span>{getProcessLabel(option, language)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="form__group">
          <legend>{t('Fecha de la atención')}</legend>
          <div className="date-picker">
            <button aria-pressed={date === today} className="chip" onClick={() => setDate(today)} type="button">{t('Hoy')}</button>
            <button aria-pressed={date === yesterday} className="chip" onClick={() => setDate(yesterday)} type="button">{t('Ayer')}</button>
            <label className="field field--compact">
              <span className="visually-hidden">{t('Otra fecha')}</span>
              <input max={today} onChange={(event) => setDate(event.target.value)} required type="date" value={date} />
            </label>
            <span className="muted">{formatDate(date, locale, 'long')}</span>
          </div>
        </fieldset>

        {duplicate && (
          <div className="confirm confirm--warning" role="alert">
            <p>
              <strong>{t('{name} ya está en el registro.', { name: duplicate.name })}</strong>{' '}
              {[duplicate.nationality, duplicate.phone, duplicate.email].filter(Boolean).join(', ')}
              {duplicate.lastAppointment && `. ${t('Última visita {date}', { date: formatDate(duplicate.lastAppointment.date, locale) })}`}
            </p>
            <p>{t('¿Es la misma persona?')}</p>
            <div className="button-row">
              <button className="button button--primary" disabled={saving} onClick={() => void submit({ useDuplicate: true })} type="button">{t('Sí, añadir a su historial')}</button>
              <button className="button button--secondary" disabled={saving} onClick={() => void submit({ forceNew: true })} type="button">{t('No, es otra persona')}</button>
            </div>
          </div>
        )}

        {error && <p className="message message--error" role="alert">{t(error)}</p>}

        {!duplicate && (
          <div className="form__submit">
            <button className="button button--primary button--large" disabled={saving} type="submit">
              <Check size={18} aria-hidden="true" />{saving ? t('Guardando…') : t('Guardar atención')}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
