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
  const [completedCheck, setCompletedCheck] = useState<CompletedWorkspaceCheck>()
  const [refreshVersion, setRefreshVersion] = useState(0)
  const refresh = useCallback(() => setRefreshVersion((version) => version + 1), [])

  useEffect(() => {
    if (!user) return

    let active = true

    void getWorkspaceMembership(user.id)
      .then((membership) => {
        if (!active) return
        setCompletedCheck({
          userId: user.id,
          refreshVersion,
          access: membership
            ? { status: 'active', membership }
            : { status: 'denied' },
        })
      })
      .catch((error: unknown) => {
        if (!active) return
        setCompletedCheck({
          userId: user.id,
          refreshVersion,
          access: {
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'No se pudo verificar la membresía del espacio de trabajo.',
          },
        })
      })

    const recheckWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', recheckWhenVisible)

    return () => {
      active = false
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', recheckWhenVisible)
    }
  }, [refresh, refreshVersion, user])

  const access = useMemo<WorkspaceAccessState>(
    () =>
      !user
        ? { status: 'no-session' }
        : completedCheck?.userId === user.id &&
            completedCheck.refreshVersion === refreshVersion
          ? completedCheck.access
          : { status: 'loading' },
    [completedCheck, refreshVersion, user],
  )

  const value = useMemo<WorkspaceContextValue>(
    () => ({ access, refresh }),
    [access, refresh],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
