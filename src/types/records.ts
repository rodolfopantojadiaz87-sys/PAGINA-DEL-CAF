// Son identificadores históricos persistidos; las etiquetas visibles se corrigen en getProcessLabel.
export const PROCESS_OPTIONS = [
  'RESIDENCIA',
  'CAMBIO DE DIRECCION',
  'DESARCHIVAR',
  'CPF',
  'RNM',
  'RENOVACION',
  'ELABORACION DE CURRICULUM',
] as const

export type ProcessType = (typeof PROCESS_OPTIONS)[number]

// Identificadores usados antes de corregir la ortografía; siguen existiendo en registros antiguos.
const LEGACY_PROCESS_ALIASES: Record<string, ProcessType> = {
  'CAMBIO DE ENDEREZO': 'CAMBIO DE DIRECCION',
  DESARCHIVAMENTO: 'DESARCHIVAR',
  'ELABORACION DE CURRICULON': 'ELABORACION DE CURRICULUM',
}

/** Convierte identificadores históricos al identificador actual para agrupar y filtrar igual. */
export function normalizeProcess(process: string): ProcessType {
  const key = process.trim().toUpperCase()
  return LEGACY_PROCESS_ALIASES[key] ?? (key as ProcessType)
}

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
  | 'reports'
  | 'settings'
