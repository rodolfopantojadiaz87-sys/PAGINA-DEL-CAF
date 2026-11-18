import { requireSupabase } from '../lib/supabase'
import type { ProcessType } from '../types/records'
import { getSemesterRange } from '../statistics/aggregates'

export interface RegisterSharedAttendanceInput {
  workspaceId: string
  personId?: string
  name: string
  nationality: string
  phone: string
  email: string
  process: ProcessType
  date: string
}

export async function registerSharedAttendance(
  input: RegisterSharedAttendanceInput,
): Promise<string> {
  const { data, error } = await requireSupabase().rpc('register_attendance', {
    target_workspace_id: input.workspaceId,
    target_person_id: input.personId ?? null,
    person_full_name: input.name.trim(),
    person_nationality: input.nationality.trim(),
    person_phone: input.phone.trim(),
    person_email: input.email.trim(),
    target_process: input.process,
    target_attended_at: input.date,
  })
  if (error) throw error
  return data
}

export async function countDistinctAttendedPeople(
  workspaceId: string,
  year: number,
  semester: 1 | 2,
): Promise<number> {
  const { start, end } = getSemesterRange(year, semester)
  const { data, error } = await requireSupabase().rpc(
    'count_distinct_attended_people',
    {
      target_workspace_id: workspaceId,
      period_start: start,
      period_end: end,
    },
  )
  if (error) throw error
  return data
}
