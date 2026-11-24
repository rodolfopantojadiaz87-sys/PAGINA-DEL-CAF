// Carga datos de prueba en el Supabase LOCAL (npx supabase start).
// Uso: node scripts/seed-local.mjs
// Nunca lo ejecutes contra el proyecto real: usa la clave de servicio local de demostración.
//
// Cuentas de prueba que crea (solo existen en local):
//   admin@caf.test        / caf-local-123  (administrador y propietario)
//   colaborador@caf.test  / caf-local-123  (colaborador)

const API_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  // Clave de servicio pública de demostración que usa toda instalación local de Supabase.
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
const PASSWORD = 'caf-local-123'

if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(API_URL)) {
  throw new Error(`Este script solo se ejecuta contra Supabase local, no contra ${API_URL}.`)
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { ...headers, ...options.headers } })
  const text = await response.text()
  if (!response.ok) throw new Error(`${options.method ?? 'GET'} ${path}: ${response.status} ${text}`)
  return text ? JSON.parse(text) : null
}

async function ensureUser(email, fullName) {
  const { users } = await request('/auth/v1/admin/users?per_page=1000')
  const existing = users.find((user) => user.email === email)
  if (existing) return existing.id
  const created = await request('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName } }),
  })
  return created.id
}

// Generador pseudoaleatorio determinista para que los datos sean siempre los mismos.
let seed = 20261124
function random() {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
const pick = (items) => items[Math.floor(random() * items.length)]

const FIRST_NAMES = ['María', 'José', 'Ana', 'Luis', 'Carmen', 'Jean', 'Rosa', 'Carlos', 'Yuleisy', 'Pedro', 'Daniela', 'Wilner', 'Andrea', 'Miguel', 'Fabiola', 'Kervens', 'Lucía', 'Jorge', 'Esther', 'Rafael', 'Nadège', 'Samuel', 'Paola', 'Héctor']
const LAST_NAMES = ['González', 'Pérez', 'Rodríguez', 'Joseph', 'Hernández', 'Pierre', 'Martínez', 'Mendoza', 'Silva', 'Jean-Baptiste', 'Romero', 'Castillo', 'Morales', 'Louis', 'Quispe', 'Flores', 'Díaz', 'Vargas']
const NATIONALITIES = [
  ['Venezuela', 30], ['Haití', 14], ['Colombia', 8], ['Bolivia', 6], ['Perú', 5],
  ['Cuba', 4], ['Angola', 2], ['Paraguay', 2], ['Argentina', 1],
]
const PROCESSES = [
  ['RESIDENCIA', 30], ['CPF', 22], ['RNM', 18], ['RENOVACION', 12],
  ['CAMBIO DE DIRECCION', 8], ['ELABORACION DE CURRICULUM', 7], ['DESARCHIVAR', 3],
]
// Identificadores antiguos que aún existen en registros reales.
const LEGACY_PROCESSES = ['CAMBIO DE ENDEREZO', 'ELABORACION DE CURRICULON']

function weighted(entries) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = random() * total
  for (const [value, weight] of entries) {
    roll -= weight
    if (roll <= 0) return value
  }
  return entries[0][0]
}

function dateBetween(start, end) {
  const time = start.getTime() + random() * (end.getTime() - start.getTime())
  return new Date(time).toISOString().slice(0, 10)
}

const adminId = await ensureUser('admin@caf.test', 'Ana Souza')
const collaboratorId = await ensureUser('colaborador@caf.test', 'Carlos Rivas')

await request('/rest/v1/workspace_members?on_conflict=workspace_id,user_id', {
  method: 'POST',
  headers: { Prefer: 'resolution=ignore-duplicates' },
  body: JSON.stringify([
    { workspace_id: WORKSPACE_ID, user_id: adminId, role: 'admin', is_active: true, is_owner: true, invitation_accepted_at: new Date().toISOString() },
    { workspace_id: WORKSPACE_ID, user_id: collaboratorId, role: 'attendant', is_active: true, is_owner: false, invitation_accepted_at: new Date().toISOString() },
  ]),
})

const existingPeople = await request(`/rest/v1/persons?select=id&workspace_id=eq.${WORKSPACE_ID}&limit=1`)
if (existingPeople.length) {
  console.log('Ya hay personas cargadas; no se duplican los datos de prueba.')
} else {
  const start = new Date(2025, 0, 6)
  const today = new Date()
  const people = Array.from({ length: 72 }, (_, index) => {
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`
    const creator = random() < 0.6 ? adminId : collaboratorId
    return {
      workspace_id: WORKSPACE_ID,
      full_name: name,
      nationality: weighted(NATIONALITIES),
      phone: random() < 0.8 ? `+55 92 9${String(8000 + index).padStart(4, '0')}-${String(Math.floor(random() * 9000) + 1000)}` : '',
      email: random() < 0.45 ? `${name.split(' ')[0].toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}${index}@correo.com` : '',
      created_by: creator,
      updated_by: creator,
    }
  })
  const inserted = await request('/rest/v1/persons', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(people),
  })

  const attendances = []
  for (const person of inserted) {
    const visits = 1 + Math.floor(random() * random() * 7)
    for (let visit = 0; visit < visits; visit += 1) {
      const process = random() < 0.04 ? pick(LEGACY_PROCESSES) : weighted(PROCESSES)
      attendances.push({
        workspace_id: WORKSPACE_ID,
        person_id: person.id,
        process,
        attended_at: dateBetween(start, today),
        created_by: random() < 0.55 ? adminId : collaboratorId,
      })
    }
  }
  await request('/rest/v1/attendances', { method: 'POST', body: JSON.stringify(attendances) })
  console.log(`Creadas ${inserted.length} personas y ${attendances.length} atenciones.`)
}

console.log('Listo. Entra con admin@caf.test o colaborador@caf.test (contraseña: caf-local-123).')
