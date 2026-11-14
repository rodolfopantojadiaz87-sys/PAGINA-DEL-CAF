import { useState, type FormEvent } from 'react'
import { CheckCircle2, RotateCcw, Save, X } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { useWorkspace } from '../auth/useWorkspace'
import { SectionTitle } from '../components/SectionTitle'
import { registerSharedAttendance } from '../services/attendanceService'
import { findPotentialDuplicates } from '../services/personService'
import { PROCESS_OPTIONS, type Person } from '../types/records'

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
}

const emptyForm: FormValues = {
  name: '',
  nationality: '',
  phone: '',
  email: '',
  process: '',
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
      }
    : emptyForm)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const { user } = useAuth()
  const { access } = useWorkspace()
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
    setValues(emptyForm)
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
            `Encontramos a ${duplicate.name} con el mismo nombre y nacionalidad. ¿Agregar la atención a su historial existente?`,
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
        ...(personId ? { personId } : {}),
      })
      setMessage('La atención se guardó correctamente.')
      setValues(emptyForm)
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
        eyebrow="REGISTRO"
        title="Nueva atención"
        description="Completa los datos de la persona y el proceso. Si ya está registrada, búscala primero para añadir la atención a su historial."
      />
      {selectedPerson && (
        <div className="notice notice--success">
          <CheckCircle2 size={19} />
          <span>Persona recuperada. Se añadirá una atención a su historial, sin duplicarla.</span>
        </div>
      )}
      <form className="surface-card form-card" onSubmit={submit}>
        <div className="form-section-heading">
          <span className="form-step">01</span>
          <div><h2>Datos personales</h2><p>{!selectedPerson ? 'Los campos con * son obligatorios.' : canEditSelectedPerson ? 'Puedes actualizar los datos personales de este registro.' : 'Sólo el administrador o quien creó el registro puede modificar estos datos.'}</p></div>
        </div>
        <div className="form-grid">
          <label className="field field--wide">
            <span>Nombre completo <b>*</b></span>
            <input autoComplete="name" disabled={!canEditSelectedPerson} maxLength={120} onChange={(event) => update('name', event.target.value)} placeholder="Ej. María González" required value={values.name} />
          </label>
          <label className="field">
            <span>Nacionalidad <b>*</b></span>
            <input autoComplete="country-name" disabled={!canEditSelectedPerson} maxLength={80} onChange={(event) => update('nationality', event.target.value)} placeholder="Ej. Argentina" required value={values.nationality} />
          </label>
          <label className="field">
            <span>Teléfono</span>
            <input autoComplete="tel" disabled={!canEditSelectedPerson} maxLength={40} onChange={(event) => update('phone', event.target.value)} placeholder="+55 11 99999-9999" type="tel" value={values.phone} />
          </label>
          <label className="field field--wide">
            <span>Correo electrónico</span>
            <input autoComplete="email" disabled={!canEditSelectedPerson} maxLength={160} onChange={(event) => update('email', event.target.value)} placeholder="nombre@correo.com" type="email" value={values.email} />
          </label>
        </div>

        <div className="form-divider" />
        <div className="form-section-heading">
          <span className="form-step">02</span>
          <div><h2>Datos de la atención</h2><p>La fecha se registra automáticamente al guardar.</p></div>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Proceso <b>*</b></span>
            <select onChange={(event) => update('process', event.target.value)} required value={values.process}>
              <option value="">Selecciona un proceso</option>
              {PROCESS_OPTIONS.map((process) => <option key={process} value={process}>{process}</option>)}
            </select>
          </label>
          <div className="field">
            <span>Fecha de atención</span>
            <div className="readonly-field"><span>Se asigna al guardar</span><span className="readonly-field__badge">Automática</span></div>
          </div>
        </div>
        {error && <p className="form-message form-message--error" role="alert">{error}</p>}
        {message && <p className="form-message form-message--success" role="status">{message}</p>}
        <div className="form-actions">
          <button className="button button--primary" disabled={saving} type="submit"><Save size={17} />{saving ? 'Guardando…' : 'Guardar registro'}</button>
          <button className="button button--secondary" onClick={clearForm} type="button"><RotateCcw size={16} />Limpiar</button>
          <button className="button button--ghost" onClick={onCancel} type="button"><X size={16} />Cancelar</button>
        </div>
      </form>
    </div>
  )
}
