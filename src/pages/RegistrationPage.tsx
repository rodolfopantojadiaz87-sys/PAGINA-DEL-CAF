import { useState, type FormEvent } from 'react'
import { CheckCircle2, RotateCcw, Save, X } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { useWorkspace } from '../auth/useWorkspace'
import { SectionTitle } from '../components/SectionTitle'
import { registerSharedAttendance } from '../services/attendanceService'
import { findPotentialDuplicates } from '../services/personService'
import { localDate } from '../services/people'
import { PROCESS_OPTIONS, type Person } from '../types/records'
import { getProcessLabel, useI18n } from '../i18n'

interface RegistrationPageProps {
  selectedPerson?: Person
  onClearSelectedPerson: () => void
  onCancel: () => void
}

interface FormValues {
  name: string
  nationality: string
  phone: string
  email: string
  process: string
  date: string
}

function createEmptyForm(): FormValues {
  return {
    name: '',
    nationality: '',
    phone: '',
    email: '',
    process: '',
    date: localDate(),
  }
}

export function RegistrationPage({
  selectedPerson,
  onClearSelectedPerson,
  onCancel,
}: RegistrationPageProps) {
  const [values, setValues] = useState<FormValues>(() => selectedPerson
    ? {
        name: selectedPerson.name,
        nationality: selectedPerson.nationality,
        phone: selectedPerson.phone,
        email: selectedPerson.email,
        process: '',
        date: localDate(),
      }
    : createEmptyForm())
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const { user } = useAuth()
  const { access } = useWorkspace()
  const { language, t } = useI18n()
  const canEditSelectedPerson =
    !selectedPerson ||
    (access.status === 'active' &&
      (access.membership.role === 'admin' || selectedPerson.createdBy === user?.id))

  function update(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setMessage('')
    setError('')
  }

  function clearForm() {
    setValues(createEmptyForm())
    setMessage('')
    setError('')
    onClearSelectedPerson()
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    try {
      if (!user || access.status !== 'active') {
        throw new Error('No tienes acceso activo al espacio compartido.')
      }

      let personId: string | undefined
      let confirmedDuplicate: Person | undefined
      if (selectedPerson?.id) {
        if (typeof selectedPerson.id !== 'string') {
          throw new Error('La persona seleccionada no tiene un identificador compartido válido.')
        }
        personId = selectedPerson.id
      } else {
        const duplicates = await findPotentialDuplicates(access.membership.workspace_id, values)
        if (duplicates.length > 1) {
          throw new Error('Encontramos varias posibles coincidencias. Busca y selecciona a la persona correcta antes de continuar.')
        }
        if (duplicates.length === 1) {
          const duplicate = duplicates[0]
          const confirmed = window.confirm(
            t('Encontramos a {name} con el mismo nombre y nacionalidad. ¿Agregar la atención a su historial existente?', { name: duplicate.name }),
          )
          if (!confirmed) {
            setError('Busca y selecciona a la persona existente, o revisa los datos antes de crear otro registro.')
            return
          }
          if (typeof duplicate.id !== 'string') {
            throw new Error('La persona coincidente no tiene un identificador compartido válido.')
          }
          personId = duplicate.id
          confirmedDuplicate = duplicate
        }
      }

      const personDetails = confirmedDuplicate ?? values
      await registerSharedAttendance({
        workspaceId: access.membership.workspace_id,
        name: personDetails.name,
        nationality: personDetails.nationality,
        phone: personDetails.phone,
        email: personDetails.email,
        process: values.process as (typeof PROCESS_OPTIONS)[number],
        date: values.date,
        ...(personId ? { personId } : {}),
      })
      setMessage('La atención se guardó correctamente.')
      setValues(createEmptyForm())
      onClearSelectedPerson()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar el registro.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-stack page-stack--narrow">
      <SectionTitle
        eyebrow={t('REGISTRO')}
        title={t('Nueva atención')}
        description={t('Completa los datos de la persona y el proceso. Si ya está registrada, búscala primero para añadir la atención a su historial.')}
      />
      {selectedPerson && (
        <div className="notice notice--success">
          <CheckCircle2 size={19} />
          <span>{t('Persona recuperada. Se añadirá una atención a su historial, sin duplicarla.')}</span>
        </div>
      )}
      <form className="surface-card form-card" onSubmit={submit}>
        <div className="form-section-heading">
          <span className="form-step">01</span>
          <div><h2>{t('Datos personales')}</h2><p>{!selectedPerson ? t('Los campos con * son obligatorios.') : canEditSelectedPerson ? t('Puedes actualizar los datos personales de este registro.') : t('Solo el administrador o quien creó el registro puede modificar estos datos.')}</p></div>
        </div>
        <div className="form-grid">
          <label className="field field--wide">
            <span>{t('Nombre completo')} <b>*</b></span>
            <input autoComplete="name" disabled={!canEditSelectedPerson} maxLength={120} onChange={(event) => update('name', event.target.value)} placeholder={t('Ej. María González')} required value={values.name} />
          </label>
          <label className="field">
            <span>{t('Nacionalidad')} <b>*</b></span>
            <input autoComplete="country-name" disabled={!canEditSelectedPerson} maxLength={80} onChange={(event) => update('nationality', event.target.value)} placeholder={t('Ej. Argentina')} required value={values.nationality} />
          </label>
          <label className="field">
            <span>{t('Teléfono')}</span>
            <input autoComplete="tel" disabled={!canEditSelectedPerson} maxLength={40} onChange={(event) => update('phone', event.target.value)} placeholder="+55 11 99999-9999" type="tel" value={values.phone} />
          </label>
          <label className="field field--wide">
            <span>{t('Correo electrónico')}</span>
            <input autoComplete="email" disabled={!canEditSelectedPerson} maxLength={160} onChange={(event) => update('email', event.target.value)} placeholder="nombre@correo.com" type="email" value={values.email} />
          </label>
        </div>

        <div className="form-divider" />
        <div className="form-section-heading">
          <span className="form-step">02</span>
          <div><h2>{t('Datos de la atención')}</h2><p>{t('Indica cuándo ocurrió la atención; puedes elegir una fecha pasada.')}</p></div>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>{t('Proceso')} <b>*</b></span>
            <select onChange={(event) => update('process', event.target.value)} required value={values.process}>
              <option value="">{t('Selecciona un proceso')}</option>
              {PROCESS_OPTIONS.map((process) => <option key={process} value={process}>{getProcessLabel(process, language)}</option>)}
            </select>
          </label>
          <div className="field">
            <span>{t('Fecha de atención')}</span>
            <input max={localDate()} onChange={(event) => update('date', event.target.value)} required type="date" value={values.date} />
          </div>
        </div>
        {error && <p className="form-message form-message--error" role="alert">{t(error)}</p>}
        {message && <p className="form-message form-message--success" role="status">{t(message)}</p>}
        <div className="form-actions">
          <button className="button button--primary" disabled={saving} type="submit"><Save size={17} />{saving ? t('Guardando…') : t('Guardar registro')}</button>
          <button className="button button--secondary" onClick={clearForm} type="button"><RotateCcw size={16} />{t('Limpiar')}</button>
          <button className="button button--ghost" onClick={onCancel} type="button"><X size={16} />{t('Cancelar')}</button>
        </div>
      </form>
    </div>
  )
}
