import Dexie, { type EntityTable } from 'dexie'
import type { Appointment, NationalityColor, Person } from '../types/records'

class AttendanceDatabase extends Dexie {
  people!: EntityTable<Person, 'id'>
  appointments!: EntityTable<Appointment, 'id'>
  nationalityColors!: EntityTable<NationalityColor, 'nationality'>

  constructor() {
    super('registro-personal-atenciones')
    this.version(1).stores({
      people: '++id, name, nationality, phone, email',
      appointments: '++id, personId, date, process, [date+personId]',
    })
    this.version(2).stores({
      people: '++id, name, nationality, phone, email',
      appointments: '++id, personId, date, process, [date+personId]',
      nationalityColors: '&nationality, slot',
    })
  }
}

export const database = new AttendanceDatabase()
