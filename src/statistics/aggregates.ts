import type { Appointment, Person } from '../types/records'

export interface CountItem {
  label: string
  count: number
  percentage: number
}

export interface ReportSummary {
  year: number
  semester: 1 | 2
  peopleCount: number
  appointmentCount: number
  processCount: number
  nationalities: CountItem[]
  processes: CountItem[]
}

interface NationalityCount {
  label: string
  count: number
}

function addNationalityCount(
  counts: Map<string, NationalityCount>,
  value: string,
): void {
  const label = value.trim() || 'Sin especificar'
  const key = label.toLocaleLowerCase()
  const existing = counts.get(key)
  if (existing) {
    existing.count += 1
  } else {
    counts.set(key, { label, count: 1 })
  }
}

function nationalitiesToItems(
  counts: Map<string, NationalityCount>,
  denominator: number,
): CountItem[] {
  return [...counts.values()]
    .map(({ label, count }) => ({
      label,
      count,
      percentage: denominator ? (count / denominator) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export function getSemesterRange(
  year: number,
  semester: 1 | 2,
): { start: string; end: string } {
  return semester === 1
    ? { start: `${year}-01-01`, end: `${year}-06-30` }
    : { start: `${year}-07-01`, end: `${year}-12-31` }
}

export function createSummary(
  people: Person[],
  appointments: Appointment[],
  year: number,
  semester: 1 | 2,
): ReportSummary {
  const { start, end } = getSemesterRange(year, semester)
  const scopedAppointments = appointments.filter(
    ({ date }) => date >= start && date <= end,
  )
  const attendedIds = new Set(scopedAppointments.map(({ personId }) => personId))
  const attendedPeople = people.filter(
    (person) => person.id !== undefined && attendedIds.has(person.id),
  )
  const peopleById = new Set(attendedPeople.map((person) => person.id))
  const nationalityCounts = new Map<string, NationalityCount>()
  for (const person of attendedPeople) {
    addNationalityCount(nationalityCounts, person.nationality)
  }

  const processCounts = new Map<string, number>()
  for (const appointment of scopedAppointments) {
    processCounts.set(
      appointment.process,
      (processCounts.get(appointment.process) ?? 0) + 1,
    )
  }

  const countItems = (
    counts: Map<string, number>,
    denominator: number,
  ): CountItem[] =>
    [...counts]
      .map(([label, count]) => ({
        label,
        count,
        percentage: denominator ? (count / denominator) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

  return {
    year,
    semester,
    peopleCount: peopleById.size,
    appointmentCount: scopedAppointments.length,
    processCount: scopedAppointments.length,
    nationalities: nationalitiesToItems(nationalityCounts, peopleById.size),
    processes: countItems(processCounts, scopedAppointments.length),
  }
}

export function createAllTimeSummary(
  people: Person[],
  appointments: Appointment[],
): Omit<ReportSummary, 'year' | 'semester'> {
  const attendedIds = new Set(appointments.map(({ personId }) => personId))
  const nationalityCounts = new Map<string, NationalityCount>()
  for (const person of people) {
    if (person.id !== undefined && attendedIds.has(person.id)) {
      addNationalityCount(nationalityCounts, person.nationality)
    }
  }
  const processCounts = new Map<string, number>()
  for (const appointment of appointments) {
    processCounts.set(
      appointment.process,
      (processCounts.get(appointment.process) ?? 0) + 1,
    )
  }
  const toItems = (counts: Map<string, number>, total: number) =>
    [...counts]
      .map(([label, count]) => ({
        label,
        count,
        percentage: total ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

  return {
    peopleCount: new Set(
      people
        .filter((person) => person.id !== undefined && attendedIds.has(person.id))
        .map((person) => person.id),
    ).size,
    appointmentCount: appointments.length,
    processCount: appointments.length,
    nationalities: nationalitiesToItems(nationalityCounts, attendedIds.size),
    processes: toItems(processCounts, appointments.length),
  }
}
