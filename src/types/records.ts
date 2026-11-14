export const PROCESS_OPTIONS = [
  'RESIDENCIA',
  'CAMBIO DE ENDEREZO',
  'DESARCHIVAMENTO',
  'CPF',
  'RNM',
  'RENOVACION',
  'ELABORACION DE CURRICULON',
] as const

export type ProcessType = (typeof PROCESS_OPTIONS)[number]

export interface Person {
  id?: number | string
  name: string
  nationality: string
  phone: string
  email: string
  createdBy?: string
  archivedAt?: string | null
}

export interface Appointment {
  id?: number | string
  personId: number | string
  date: string
  process: ProcessType
  createdBy?: string
  creatorName?: string
}

export interface NationalityColor {
  nationality: string
  label: string
  color: string
  slot: number
}

export interface PersonWithHistory extends Person {
  appointments: Appointment[]
  lastAppointment?: Appointment
}

export interface BackupFile {
  format: 'registro-atenciones-backup'
  version: 1
  exportedAt: string
  people: Person[]
  appointments: Appointment[]
  nationalityColors?: NationalityColor[]
}

export type Section =
  | 'home'
  | 'new'
  | 'search'
  | 'people'
  | 'statistics'
  | 'reports'
  | 'settings'
