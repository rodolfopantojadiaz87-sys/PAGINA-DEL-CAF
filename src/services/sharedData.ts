import { requireSupabase } from '../lib/supabase'
import type { Database } from '../types/database.types'
import { normalizeProcess, type Appointment, type Person, type PersonWithHistory } from '../types/records'
import { sortHistory } from '../lib/dates'

type PersonRow = Database['public']['Tables']['persons']['Row']
type AttendanceRow = Database['public']['Tables']['attendances']['Row']
type ProfileRow = Database['public']['Tables']['profiles']['Row']

export interface SharedAttendanceData {
  people: PersonWithHistory[]
  appointments: Appointment[]
}

function mapPerson(row: PersonRow): Person {
  return {
    id: row.id,
    name: row.full_name,
    nationality: row.nationality,
    phone: row.phone,
    email: row.email,
    createdBy: row.created_by,
    archivedAt: row.archived_at,
  }
}

function mapAttendance(
  row: AttendanceRow,
  profileById: Map<string, ProfileRow>,
): Appointment {
  const profile = profileById.get(row.created_by)
  return {
    id: row.id,
    personId: row.person_id,
    date: row.attended_at,
    process: normalizeProcess(row.process),
    createdBy: row.created_by,
    creatorName: profile?.full_name ?? profile?.email ?? 'Colaborador',
  }
}

export async function getSharedAttendanceData(
  workspaceId: string,
): Promise<SharedAttendanceData> {
  const client = requireSupabase()
  const [personRows, attendanceRows] = await Promise.all([
    fetchAllPersons(workspaceId),
    fetchAllAttendances(workspaceId),
  ])
  const persons = personRows.map(mapPerson)
  const personIds = new Set(persons.flatMap((person) => (person.id ? [person.id] : [])))
  const activeAttendanceRows = attendanceRows.filter((row) =>
    personIds.has(row.person_id),
  )
  const profileById = await fetchProfiles(client, activeAttendanceRows.map(({ created_by }) => created_by))
  const appointments = activeAttendanceRows.map((row) => mapAttendance(row, profileById))
  const histories = new Map<string, Appointment[]>()
  for (const appointment of appointments) {
    const personId = String(appointment.personId)
    const history = histories.get(personId) ?? []
    history.push(appointment)
    histories.set(personId, history)
  }

  const people: PersonWithHistory[] = persons.map((person) => {
    const history = sortHistory(histories.get(String(person.id)) ?? [])
    return {
      ...person,
      appointments: history,
      lastAppointment: history[0],
    }
  })

  return { people, appointments }
}

export async function getSharedPersonHistory(
  workspaceId: string,
  personId: string,
): Promise<PersonWithHistory | undefined> {
  const client = requireSupabase()
  const { data: personRow, error: personError } = await client
    .from('persons')
    .select(
      'id, workspace_id, full_name, nationality, phone, email, created_by, updated_by, created_at, updated_at, archived_at',
    )
    .eq('workspace_id', workspaceId)
    .eq('id', personId)
    .is('archived_at', null)
    .maybeSingle()
  if (personError) throw personError
  if (!personRow) return undefined

  const { data: attendanceRows, error: attendanceError } = await client
    .from('attendances')
    .select(
      'id, workspace_id, person_id, process, attended_at, created_by, created_at, updated_at',
    )
    .eq('workspace_id', workspaceId)
    .eq('person_id', personId)
    .order('attended_at', { ascending: false })
  if (attendanceError) throw attendanceError

  const profileById = await fetchProfiles(client, attendanceRows.map(({ created_by }) => created_by))
  const appointments = sortHistory(
    attendanceRows.map((row) => mapAttendance(row, profileById)),
  )
  return {
    ...mapPerson(personRow),
    appointments,
    lastAppointment: appointments[0],
  }
}

export function filterSharedPeople(
  people: PersonWithHistory[],
  query: string,
): PersonWithHistory[] {
  const term = query.trim().toLocaleLowerCase()
  const phoneTerm = query.replace(/\D/g, '')
  return people.filter((person) => {
    if (person.archivedAt) return false
    if (!term) return true
    return (
      person.name.toLocaleLowerCase().includes(term) ||
      person.email.toLocaleLowerCase().includes(term) ||
      person.phone.toLocaleLowerCase().includes(term) ||
      Boolean(phoneTerm && person.phone.replace(/\D/g, '').includes(phoneTerm))
    )
  })
}

async function fetchAllPersons(workspaceId: string) {
  const client = requireSupabase()
  const pageSize = 500
  const rows: PersonRow[] = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from('persons')
      .select(
        'id, workspace_id, full_name, nationality, phone, email, created_by, updated_by, created_at, updated_at, archived_at',
      )
      .eq('workspace_id', workspaceId)
      .order('full_name')
      .order('id')
      .range(offset, offset + pageSize - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < pageSize) return rows
  }
}

async function fetchAllAttendances(workspaceId: string) {
  const client = requireSupabase()
  const pageSize = 500
  const rows: AttendanceRow[] = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from('attendances')
      .select(
        'id, workspace_id, person_id, process, attended_at, created_by, created_at, updated_at',
      )
      .eq('workspace_id', workspaceId)
      .order('attended_at', { ascending: false })
      .order('id')
      .range(offset, offset + pageSize - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < pageSize) return rows
  }
}

async function fetchProfiles(
  client: ReturnType<typeof requireSupabase>,
  creatorIds: string[],
): Promise<Map<string, ProfileRow>> {
  const uniqueIds = [...new Set(creatorIds)]
  const profiles: ProfileRow[] = []
  for (let offset = 0; offset < uniqueIds.length; offset += 200) {
    const { data, error } = await client
      .from('profiles')
      .select('id, full_name, email, created_at')
      .in('id', uniqueIds.slice(offset, offset + 200))
    if (error) throw error
    profiles.push(...data)
  }
  return new Map(profiles.map((profile) => [profile.id, profile]))
}
