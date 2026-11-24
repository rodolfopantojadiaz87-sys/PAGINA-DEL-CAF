import { createContext, useContext } from 'react'
import type { Appointment, PersonWithHistory } from '../types/records'

export interface AttendanceDataValue {
  people: PersonWithHistory[]
  appointments: Appointment[]
  peopleById: Map<string, PersonWithHistory>
  loading: boolean
  error: string
  /** Vuelve a cargar los datos compartidos (después de guardar, editar o eliminar). */
  refresh: () => void
}

export const AttendanceDataContext = createContext<AttendanceDataValue | null>(null)

export function useAttendanceData(): AttendanceDataValue {
  const context = useContext(AttendanceDataContext)
  if (!context) throw new Error('useAttendanceData debe usarse dentro de AttendanceDataProvider.')
  return context
}
