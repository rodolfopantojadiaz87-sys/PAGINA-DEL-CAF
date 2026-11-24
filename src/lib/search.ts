import type { Person } from '../types/records'

/** Minúsculas y sin tildes, para que "maria" encuentre a "María". */
export function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase().trim()
}

/**
 * Puntuación de coincidencia de una persona con la búsqueda (0 = no coincide).
 * Prioriza nombres que empiezan por el texto, luego palabras que empiezan por él,
 * luego coincidencias parciales, teléfono y correo.
 */
export function matchScore(person: Person, query: string): number {
  const term = fold(query)
  if (!term) return 1
  const name = fold(person.name)
  if (name.startsWith(term)) return 4
  if (name.split(/\s+/).some((word) => word.startsWith(term))) return 3
  if (term.split(/\s+/).every((part) => name.includes(part))) return 2
  const digits = query.replace(/\D/g, '')
  if (digits.length >= 3 && person.phone.replace(/\D/g, '').includes(digits)) return 1.5
  if (term.includes('@') || term.length >= 3) {
    if (fold(person.email).includes(term)) return 1
  }
  return 0
}

export function searchPeople<T extends Person>(people: T[], query: string): T[] {
  if (!query.trim()) return people
  return people
    .map((person) => ({ person, score: matchScore(person, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name))
    .map(({ person }) => person)
}
