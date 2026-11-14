import { createContext } from 'react'
import type { WorkspaceMembership } from '../services/workspaceService'

export type WorkspaceAccessState =
  | { status: 'loading' }
  | { status: 'no-session' }
  | { status: 'denied' }
  | { status: 'active'; membership: WorkspaceMembership }
  | { status: 'error'; message: string }

export interface WorkspaceContextValue {
  access: WorkspaceAccessState
  refresh: () => void
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
