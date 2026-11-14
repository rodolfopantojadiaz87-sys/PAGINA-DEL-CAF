import { database } from '../database/database'
import {
  PROCESS_OPTIONS,
  type Appointment,
  type BackupFile,
  type NationalityColor,
  type Person,
} from '../types/records'

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function isPerson(value: unknown): value is Person {
  if (!value || typeof value !== 'object') return false
  const person = value as Record<string, unknown>
  return (
    (person.id === undefined ||
      (Number.isInteger(person.id) && Number(person.id) > 0)) &&
    typeof person.name === 'string' &&
    typeof person.nationality === 'string' &&
    typeof person.phone === 'string' &&
    typeof person.email === 'string'
  )
}

function isAppointment(value: unknown): value is Appointment {
  if (!value || typeof value !== 'object') return false
  const appointment = value as Record<string, unknown>
  return (
    (appointment.id === undefined ||
      (Number.isInteger(appointment.id) && Number(appointment.id) > 0)) &&
    Number.isInteger(appointment.personId) &&
    Number(appointment.personId) > 0 &&
    typeof appointment.date === 'string' &&
    isValidDate(appointment.date) &&
    typeof appointment.process === 'string' &&
    PROCESS_OPTIONS.some((process) => process === appointment.process)
  )
}

function isNationalityColor(value: unknown): value is NationalityColor {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.nationality === 'string' &&
    typeof entry.label === 'string' &&
    /^#[0-9A-F]{6}$/i.test(String(entry.color)) &&
    Number.isInteger(entry.slot) &&
    Number(entry.slot) >= 0
  )
}

export async function createBackup(): Promise<BackupFile> {
  const [people, appointments, nationalityColors] = await Promise.all([
    database.people.toArray(),
    database.appointments.toArray(),
    database.nationalityColors.toArray(),
  ])
  return {
    format: 'registro-atenciones-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    people,
    appointments,
    nationalityColors,
  }
}

export async function restoreBackup(value: unknown): Promise<number> {
  if (!value || typeof value !== 'object') {
    throw new Error('El archivo no contiene una copia de seguridad válida.')
  }
  const backup = value as Partial<BackupFile>
  if (
    backup.format !== 'registro-atenciones-backup' ||
    backup.version !== 1 ||
    !Array.isArray(backup.people) ||
    !Array.isArray(backup.appointments) ||
    (backup.nationalityColors !== undefined &&
      (!Array.isArray(backup.nationalityColors) ||
        !backup.nationalityColors.every(isNationalityColor))) ||
    !backup.people.every(isPerson) ||
    !backup.appointments.every(isAppointment)
  ) {
    throw new Error('El formato o los datos de la copia de seguridad no son válidos.')
  }

  const personIds = new Set(
    backup.people.flatMap((person) => (person.id === undefined ? [] : [person.id])),
  )
  if (personIds.size !== backup.people.filter((person) => person.id !== undefined).length) {
    throw new Error('La copia contiene identificadores de persona duplicados.')
  }
  const appointmentIds = backup.appointments.flatMap((appointment) =>
    appointment.id === undefined ? [] : [appointment.id],
  )
  if (new Set(appointmentIds).size !== appointmentIds.length) {
    throw new Error('La copia contiene identificadores de atención duplicados.')
  }
  const nationalityColors = backup.nationalityColors ?? []
  if (
    new Set(nationalityColors.map(({ nationality }) => nationality)).size !==
      nationalityColors.length ||
    new Set(nationalityColors.map(({ color }) => color.toUpperCase())).size !==
      nationalityColors.length
  ) {
    throw new Error('La copia contiene colores de nacionalidad duplicados.')
  }
  if (backup.appointments.some((appointment) => !personIds.has(appointment.personId))) {
    throw new Error('La copia contiene atenciones sin una persona relacionada.')
  }

  const people = backup.people
  const appointments = backup.appointments
  await database.transaction(
    'rw',
    database.people,
    database.appointments,
    database.nationalityColors,
    async () => {
      await database.appointments.clear()
      await database.people.clear()
      await database.nationalityColors.clear()
      await database.people.bulkAdd(people)
      await database.appointments.bulkAdd(appointments)
      if (nationalityColors.length) {
        await database.nationalityColors.bulkAdd(nationalityColors)
      }
    },
  )
  return people.length
}
