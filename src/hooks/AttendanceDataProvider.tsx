import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useWorkspace } from '../auth/useWorkspace'
import { getSharedAttendanceData, type SharedAttendanceData } from '../services/sharedData'
import { AttendanceDataContext, type AttendanceDataValue } from './useAttendanceData'

const EMPTY: SharedAttendanceData = { people: [], appointments: [] }

/**
 * Carga personas y atenciones una sola vez para toda la aplicación. Al refrescar se
 * conservan los datos anteriores en pantalla hasta que llegan los nuevos.
 */
export function AttendanceDataProvider({ children }: { children: ReactNode }) {
  const { access } = useWorkspace()
  const workspaceId = access.status === 'active' ? access.membership.workspace_id : undefined
  const [data, setData] = useState<SharedAttendanceData>(EMPTY)
  const [loadedVersion, setLoadedVersion] = useState(-1)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const refresh = useCallback(() => setVersion((current) => current + 1), [])

  useEffect(() => {
    if (!workspaceId) return
    let active = true
    getSharedAttendanceData(workspaceId).then(
      (next) => {
        if (!active) return
        setData(next)
        setError('')
        setLoadedVersion(version)
      },
      (caught: unknown) => {
        if (!active) return
        setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los datos compartidos.')
        setLoadedVersion(version)
      },
    )
    return () => {
      active = false
    }
  }, [workspaceId, version])

  const value = useMemo<AttendanceDataValue>(() => {
    const visiblePeople = data.people.filter((person) => !person.archivedAt)
    return {
      people: visiblePeople,
      appointments: data.appointments,
      peopleById: new Map(data.people.map((person) => [String(person.id), person])),
      // Solo la primera carga muestra el estado de carga; los refrescos son silenciosos.
      loading: loadedVersion < 0,
      error,
      refresh,
    }
  }, [data, error, loadedVersion, refresh])

  return <AttendanceDataContext.Provider value={value}>{children}</AttendanceDataContext.Provider>
}
