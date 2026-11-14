import { requireSupabase } from '../lib/supabase'
import type { Database } from '../types/database.types'
import { SHARED_WORKSPACE_ID } from '../constants/workspace'

export type WorkspaceMembership =
  Database['public']['Tables']['workspace_members']['Row']

export async function getWorkspaceMembership(
  userId: string,
): Promise<WorkspaceMembership | null> {
  const { data, error } = await requireSupabase()
    .from('workspace_members')
    .select('id, workspace_id, user_id, role, is_active, is_owner, invitation_accepted_at, created_at')
    .eq('workspace_id', SHARED_WORKSPACE_ID)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data || !data.is_active) return null
  return data
}
