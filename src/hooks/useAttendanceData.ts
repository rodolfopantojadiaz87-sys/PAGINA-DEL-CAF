import { useCallback, useEffect, useMemo, useState } from 'react'
import { useWorkspace } from '../auth/useWorkspace'
import { getSharedAttendanceData, type SharedAttendanceData } from '../services/sharedData'

export function useAttendanceData() {
  const { access } = useWorkspace()
  const workspaceId = access.status === 'active' ? access.membership.workspace_id : undefined
  const [result, setResult] = useState<{
    workspaceId: string
    refreshVersion: number
    data: SharedAttendanceData
    error?: string
  }>()
  const [refreshVersion, setRefreshVersion] = useState(0)
  const refresh = useCallback(() => setRefreshVersion((version) => version + 1), [])

  useEffect(() => {
    if (!workspaceId) return
    let active = true
    void getSharedAttendanceData(workspaceId).then(
      (data) => {
        if (active) setResult({ workspaceId, refreshVersion, data })
      },
      (caught: unknown) => {
        if (active) {
          setResult({
            workspaceId,
            refreshVersion,
            data: { people: [], appointments: [] },
            error: caught instanceof Error ? caught.message : 'No se pudieron cargar los datos compartidos.',
          })
        }
      },
    )
    return () => {
      active = false
    }
  }, [workspaceId, refreshVersion])

  const isCurrentResult =
    result?.workspaceId === workspaceId && result?.refreshVersion === refreshVersion
  const data = isCurrentResult ? result?.data : undefined
  const error = isCurrentResult ? result?.error ?? '' : ''
  const loading = Boolean(workspaceId) && !isCurrentResult
  const emptyData = useMemo<SharedAttendanceData>(() => ({ people: [], appointments: [] }), [])
  return {
    people: data?.people ?? emptyData.people,
    appointments: data?.appointments ?? emptyData.appointments,
    loading,
    error,
    refresh,
  }
}
