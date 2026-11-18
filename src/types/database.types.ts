export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type Table<Row, Insert, Update> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

type ProfileRow = {
  id: string
  full_name: string
  email: string | null
  created_at: string
}

type WorkspaceRow = {
  id: string
  name: string
  created_at: string
}

type WorkspaceMemberRow = {
  id: string
  workspace_id: string
  user_id: string
  role: 'admin' | 'attendant'
  is_active: boolean
  is_owner: boolean
  invitation_accepted_at: string | null
  created_at: string
}

type PersonRow = {
  id: string
  workspace_id: string
  full_name: string
  nationality: string
  phone: string
  email: string
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
  archived_at: string | null
}

type AttendanceRow = {
  id: string
  workspace_id: string
  person_id: string
  process: string
  attended_at: string
  created_by: string
  created_at: string
  updated_at: string
}

type NationalityColorRow = {
  id: string
  workspace_id: string
  nationality_key: string
  nationality_label: string
  color: string
  created_at: string
}

type AdminActivityRow = {
  id: string
  workspace_id: string
  actor_user_id: string | null
  action: string
  target_type: string
  target_id: string | null
  details: Json
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        ProfileRow,
        Pick<ProfileRow, 'id' | 'full_name'> & Partial<Pick<ProfileRow, 'email' | 'created_at'>>,
        Partial<Pick<ProfileRow, 'full_name'>>
      >
      workspaces: Table<
        WorkspaceRow,
        Pick<WorkspaceRow, 'name'> & Partial<Pick<WorkspaceRow, 'id' | 'created_at'>>,
        Partial<Pick<WorkspaceRow, 'name'>>
      >
      workspace_members: Table<
        WorkspaceMemberRow,
        Pick<WorkspaceMemberRow, 'workspace_id' | 'user_id' | 'role'> &
          Partial<
            Pick<
              WorkspaceMemberRow,
              'id' | 'is_active' | 'is_owner' | 'invitation_accepted_at' | 'created_at'
            >
          >,
        Partial<Pick<WorkspaceMemberRow, 'role' | 'is_active'>>
      >
      persons: Table<
        PersonRow,
        Pick<PersonRow, 'workspace_id' | 'full_name' | 'nationality' | 'created_by' | 'updated_by'> &
          Partial<
            Pick<PersonRow, 'id' | 'phone' | 'email' | 'created_at' | 'updated_at' | 'archived_at'>
          >,
        Partial<
          Pick<
            PersonRow,
            | 'full_name'
            | 'nationality'
            | 'phone'
            | 'email'
            | 'updated_by'
            | 'updated_at'
            | 'archived_at'
          >
        >
      >
      attendances: Table<
        AttendanceRow,
        Pick<AttendanceRow, 'workspace_id' | 'person_id' | 'process' | 'created_by'> &
          Partial<Pick<AttendanceRow, 'id' | 'attended_at' | 'created_at' | 'updated_at'>>,
        Partial<Pick<AttendanceRow, 'process' | 'attended_at' | 'updated_at'>>
      >
      nationality_colors: Table<
        NationalityColorRow,
        Pick<
          NationalityColorRow,
          'workspace_id' | 'nationality_key' | 'nationality_label' | 'color'
        > &
          Partial<Pick<NationalityColorRow, 'id' | 'created_at'>>,
        Partial<Pick<NationalityColorRow, 'nationality_label' | 'color'>>
      >
      admin_activity: Table<
        AdminActivityRow,
        Pick<AdminActivityRow, 'workspace_id' | 'action' | 'target_type'> &
          Partial<
            Pick<AdminActivityRow, 'id' | 'actor_user_id' | 'target_id' | 'details' | 'created_at'>
          >,
        Partial<Pick<AdminActivityRow, 'details'>>
      >
    }
    Views: Record<string, never>
    Functions: {
      is_active_workspace_member: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      is_workspace_admin: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      can_modify_record: {
        Args: { target_workspace_id: string; record_creator_id: string }
        Returns: boolean
      }
      can_view_profile: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      accept_workspace_invitation: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      remove_workspace_member: {
        Args: { target_member_id: string; target_workspace_id: string }
        Returns: undefined
      }
      register_attendance: {
        Args: {
          target_workspace_id: string
          target_person_id: string | null
          person_full_name: string
          person_nationality: string
          person_phone: string
          person_email: string
          target_process: string
          target_attended_at: string
        }
        Returns: string
      }
      count_distinct_attended_people: {
        Args: {
          target_workspace_id: string
          period_start: string
          period_end: string
        }
        Returns: number
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
