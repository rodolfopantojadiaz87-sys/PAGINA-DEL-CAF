import { requireSupabase } from '../lib/supabase'
import { normalizeProcess, type Person, type PersonWithHistory } from '../types/records'
import { filterSharedPeople, getSharedAttendanceData } from './sharedData'

export interface PotentialDuplicateInput {
  name: string
  nationality: string
  phone: string
  email: string
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase()
}

export async function findPotentialDuplicates(
  workspaceId: string,
  input: PotentialDuplicateInput,
): Promise<PersonWithHistory[]> {
  const name = normalized(input.name)
  const email = normalized(input.email)
  const phone = input.phone.replace(/\D/g, '')
  if (!name) return []

  const { data: rows, error } = await requireSupabase()
    .from('persons')
    .select(
      'id, workspace_id, full_name, nationality, phone, email, created_by, updated_by, created_at, updated_at, archived_at',
    )
    .eq('workspace_id', workspaceId)
    .is('archived_at', null)
    .ilike('full_name', input.name.trim().replace(/[\\%_]/g, '\\$&'))
    .ilike('nationality', input.nationality.trim().replace(/[\\%_]/g, '\\$&'))
  if (error) throw error

  const candidates = rows.filter((person) =>
    normalized(person.full_name) === name &&
    normalized(person.nationality) === normalized(input.nationality) &&
    ((!email && !phone) ||
      (!person.email.trim() && !person.phone.replace(/\D/g, '')) ||
      Boolean(
        (email && normalized(person.email) === email) ||
        (phone && person.phone.replace(/\D/g, '') === phone),
      )),
  )
  if (!candidates.length) return []
  const candidateIds = candidates.map(({ id }) => id)
  const { data: attendanceRows, error: attendanceError } = await requireSupabase()
    .from('attendances')
    .select(
      'id, workspace_id, person_id, process, attended_at, created_by, created_at, updated_at',
    )
    .eq('workspace_id', workspaceId)
    .in('person_id', candidateIds)
    .order('attended_at', { ascending: false })
  if (attendanceError) throw attendanceError

  const creatorIds = [...new Set(attendanceRows.map(({ created_by }) => created_by))]
  const profileResult = creatorIds.length
    ? await requireSupabase()
        .from('profiles')
        .select('id, full_name, email, created_at')
        .in('id', creatorIds)
    : { data: [], error: null }
  if (profileResult.error) throw profileResult.error

  const profileById = new Map(
    profileResult.data.map((profile) => [profile.id, profile]),
  )
  return candidates.map((row) => {
    const appointments = attendanceRows
      .filter((attendance) => attendance.person_id === row.id)
      .map((attendance) => ({
        id: attendance.id,
        personId: attendance.person_id,
        date: attendance.attended_at,
        process: normalizeProcess(attendance.process),
        createdBy: attendance.created_by,
        creatorName:
          profileById.get(attendance.created_by)?.full_name ??
          profileById.get(attendance.created_by)?.email ??
          'Colaborador',
      }))
    const sortedAppointments = appointments.sort((a, b) => b.date.localeCompare(a.date))
    return {
      id: row.id,
      name: row.full_name,
      nationality: row.nationality,
      phone: row.phone,
      email: row.email,
      createdBy: row.created_by,
      appointments: sortedAppointments,
      lastAppointment: sortedAppointments[0],
    }
  })
}

export async function findSharedPeople(
  workspaceId: string,
  query: string,
): Promise<PersonWithHistory[]> {
  const { people } = await getSharedAttendanceData(workspaceId)
  return filterSharedPeople(people, query)
}

export async function getAllSharedPeople(
  workspaceId: string,
): Promise<PersonWithHistory[]> {
  const { people } = await getSharedAttendanceData(workspaceId)
  return people.filter((person) => !person.archivedAt)
}

export async function updateSharedPerson(
  workspaceId: string,
  userId: string,
  person: Person,
): Promise<void> {
  if (!person.id || typeof person.id !== 'string') {
    throw new Error('No se pudo identificar la persona que se desea editar.')
  }
  const { data, error } = await requireSupabase()
    .from('persons')
    .update({
      full_name: person.name.trim(),
      nationality: person.nationality.trim(),
      phone: person.phone.trim(),
      email: person.email.trim(),
      updated_by: userId,
    })
    .eq('workspace_id', workspaceId)
    .eq('id', person.id)
    .select('id')
  if (error) throw error
  if (!data.length) {
    throw new Error('No se guardaron los cambios: la persona ya no existe o no tienes permiso para editarla.')
  }
}

export async function archiveSharedPerson(
  workspaceId: string,
  personId: string,
): Promise<void> {
  const { error } = await requireSupabase()
    .from('persons')
    .update({ archived_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('id', personId)
  if (error) throw error
}

export async function deleteSharedPerson(
  workspaceId: string,
  personId: string,
): Promise<void> {
  const { data, error } = await requireSupabase()
    .from('persons')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', personId)
    .select('id')
  if (error) throw error
  if (!data.length) {
    throw new Error('No se eliminó la persona: ya no existe o no tienes permiso para eliminarla.')
  }
}
