import { requireSupabase } from '../lib/supabase'
import type { Database } from '../types/database.types'

export type WorkspaceMember =
  Database['public']['Tables']['workspace_members']['Row']

export interface WorkspaceUser extends WorkspaceMember {
  email: string | null
  full_name: string
  account_created_at: string
}

export async function listWorkspaceUsers(
  workspaceId: string,
): Promise<WorkspaceUser[]> {
  const client = requireSupabase()
  const { data: members, error: memberError } = await client
    .from('workspace_members')
    .select('id, workspace_id, user_id, role, is_active, is_owner, invitation_accepted_at, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at')
  if (memberError) throw memberError
  if (!members.length) return []

  const { data: profiles, error: profileError } = await client
    .from('profiles')
    .select('id, full_name, email, created_at')
    .in('id', members.map(({ user_id }) => user_id))
  if (profileError) throw profileError

  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))
  return members.map((member) => {
    const profile = profilesById.get(member.user_id)
    if (!profile) {
      throw new Error(`No se encontró el perfil de la cuenta ${member.user_id}.`)
    }
    return {
      ...member,
      email: profile.email,
      full_name: profile.full_name,
      account_created_at: profile.created_at,
    }
  })
}

export async function updateWorkspaceMember(
  workspaceId: string,
  memberId: string,
  changes: Pick<WorkspaceMember, 'role' | 'is_active'>,
): Promise<void> {
  const { error } = await requireSupabase()
    .from('workspace_members')
    .update(changes)
    .eq('workspace_id', workspaceId)
    .eq('id', memberId)
  if (error) throw error
}

export async function inviteWorkspaceUser(
  email: string,
): Promise<void> {
  const { error } = await requireSupabase().functions.invoke('invite-user', {
    body: { email: email.trim() },
  })
  if (error) throw error
}
