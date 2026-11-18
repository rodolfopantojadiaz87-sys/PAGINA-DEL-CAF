import { database } from '../database/database'
import type {
  Appointment,
  Person,
  PersonWithHistory,
  ProcessType,
} from '../types/records'

export interface RegistrationInput extends Person {
  process: ProcessType
  personId?: string | number
}

export class AmbiguousPersonError extends Error {
  constructor() {
    super('Hay varias personas con esos datos. Busca y selecciona la persona correcta.')
    this.name = 'AmbiguousPersonError'
  }
}

export function localDate(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase()
}

export async function registerAppointment(
  input: RegistrationInput,
): Promise<number> {
  return database.transaction('rw', database.people, database.appointments, async () => {
    if (typeof input.personId === 'string') {
      throw new Error('Los identificadores compartidos solo se pueden guardar en Supabase.')
    }
    let person = input.personId
      ? await database.people.get(input.personId)
      : undefined

    if (input.personId && !person) {
      throw new Error('La persona seleccionada ya no existe.')
    }

    if (!person) {
      const email = normalized(input.email)
      const phone = input.phone.replace(/\D/g, '')
      const name = normalized(input.name)
      const nationality = normalized(input.nationality)
      const matches = await database.people.toArray()
      const candidates = matches.filter((candidate) => {
        const sameName = normalized(candidate.name) === name
        const sameNationality = normalized(candidate.nationality) === nationality
        const candidatePhone = candidate.phone.replace(/\D/g, '')
        const sameEmail = Boolean(
          email && candidate.email && normalized(candidate.email) === email,
        )
        const samePhone = Boolean(phone && candidatePhone && phone === candidatePhone)
        const emailConflicts =
          email && candidate.email && normalized(candidate.email) !== email
        const phoneConflicts = phone && candidatePhone && phone !== candidatePhone

        return (
          sameName &&
          sameNationality &&
          (sameEmail || samePhone) &&
          !emailConflicts &&
          !phoneConflicts
        )
      })

      if (candidates.length > 1) {
        throw new AmbiguousPersonError()
      }
      person = candidates[0]
    }

    const personData: Person = {
      name: input.name.trim(),
      nationality: input.nationality.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
    }
    let personId: number
    if (person?.id !== undefined && typeof person.id === 'number') {
      await database.people.update(person.id, personData)
      personId = person.id
    } else if (person?.id !== undefined) {
      throw new Error('Los identificadores compartidos solo se pueden guardar en Supabase.')
    } else {
      const newId = await database.people.add(personData)
      if (typeof newId !== 'number') {
        throw new Error('No se pudo obtener el identificador de la persona guardada.')
      }
      personId = newId
    }

    await database.appointments.add({
      personId,
      date: localDate(),
      process: input.process,
    })

    return personId
  })
}

export async function savePerson(person: Person): Promise<void> {
  if (!person.id || typeof person.id !== 'number') {
    throw new Error('No se pudo identificar la persona que se desea editar.')
  }
  await database.people.update(person.id, {
    name: person.name.trim(),
    nationality: person.nationality.trim(),
    phone: person.phone.trim(),
    email: person.email.trim(),
  })
}

export async function deletePerson(personId: string | number): Promise<void> {
  if (typeof personId !== 'number') {
    throw new Error('Los identificadores compartidos solo se pueden eliminar en Supabase.')
  }
  await database.transaction('rw', database.people, database.appointments, async () => {
    await database.appointments.where('personId').equals(personId).delete()
    await database.people.delete(personId)
  })
}

export async function getPersonHistory(personId: string | number): Promise<PersonWithHistory | undefined> {
  if (typeof personId !== 'number') return undefined
  const person = await database.people.get(personId)
  if (!person) return undefined

  const appointments = await database.appointments
    .where('personId')
    .equals(personId)
    .toArray()
  const history = sortHistory(appointments)

  return {
    ...person,
    appointments: history,
    lastAppointment: history[0],
  }
}

export async function findPeople(query: string): Promise<PersonWithHistory[]> {
  const term = normalized(query)
  const phoneTerm = query.replace(/\D/g, '')
  const people = await database.people.toArray()
  const matches = term
    ? people.filter((person) =>
        normalized(person.name).includes(term) ||
        normalized(person.email).includes(term) ||
        normalized(person.phone).includes(term) ||
        Boolean(phoneTerm && person.phone.replace(/\D/g, '').includes(phoneTerm)),
      )
    : people
  const appointments = await database.appointments.toArray()

  return matches
    .map((person) => {
      const history = appointments
        .filter((appointment) => appointment.personId === person.id)
        .sort((a, b) => b.date.localeCompare(a.date))
      return { ...person, appointments: history, lastAppointment: history[0] }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function getAllPeopleWithHistory(): Promise<PersonWithHistory[]> {
  return findPeople('')
}

export function sortHistory(history: Appointment[]): Appointment[] {
  return [...history].sort((a, b) => b.date.localeCompare(a.date))
}
