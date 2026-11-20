import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './useAuth'
import {
  WorkspaceContext,
  type WorkspaceAccessState,
  type WorkspaceContextValue,
} from './workspaceContext'
import { getWorkspaceMembership } from '../services/workspaceService'

type CompletedWorkspaceCheck = {
  userId: string
  refreshVersion: number
  access: Exclude<WorkspaceAccessState, { status: 'loading' | 'no-session' }>
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  // El id es estable; el objeto `user` cambia en cada renovación del token.
  const userId = user?.id
  const [completedCheck, setCompletedCheck] = useState<CompletedWorkspaceCheck>()
  const [refreshVersion, setRefreshVersion] = useState(0)
  const refresh = useCallback(() => setRefreshVersion((version) => version + 1), [])

  useEffect(() => {
    if (!userId) return

    let active = true

    void getWorkspaceMembership(userId)
      .then((membership) => {
        if (!active) return
        setCompletedCheck({
          userId,
          refreshVersion,
          access: membership
            ? { status: 'active', membership }
            : { status: 'denied' },
        })
      })
      .catch((error: unknown) => {
        if (!active) return
        setCompletedCheck((previous) =>
          // Un fallo de red al volver a la pestaña no debe expulsar a quien ya tenía acceso.
          previous?.userId === userId && previous.access.status === 'active'
            ? { ...previous, refreshVersion }
            : {
                userId,
                refreshVersion,
                access: {
                  status: 'error',
                  message:
                    error instanceof Error
                      ? error.message
                      : 'No se pudo verificar la membresía del espacio de trabajo.',
                },
              },
        )
      })

    return () => {
      active = false
    }
  }, [refreshVersion, userId])

  useEffect(() => {
    if (!userId) return
    const recheckWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', recheckWhenVisible)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', recheckWhenVisible)
    }
  }, [refresh, userId])

  const access = useMemo<WorkspaceAccessState>(() => {
    if (!userId) return { status: 'no-session' }
    if (completedCheck?.userId !== userId) return { status: 'loading' }
    if (completedCheck.refreshVersion === refreshVersion) return completedCheck.access
    // Mientras se vuelve a comprobar, se mantiene el acceso activo para no desmontar
    // la aplicación (y perder formularios a medio llenar) cada vez que se cambia de pestaña.
    return completedCheck.access.status === 'active'
      ? completedCheck.access
      : { status: 'loading' }
  }, [completedCheck, refreshVersion, userId])

  const value = useMemo<WorkspaceContextValue>(
    () => ({ access, refresh }),
    [access, refresh],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
