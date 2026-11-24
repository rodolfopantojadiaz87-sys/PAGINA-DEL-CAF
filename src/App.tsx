import { lazy, Suspense, useCallback, useState } from 'react'
import './App.css'
import { useAuth } from './auth/useAuth'
import { useWorkspace } from './auth/useWorkspace'
import { AppShell } from './components/AppShell'
import { PersonDrawer } from './components/PersonDrawer'
import { AttendanceDataProvider } from './hooks/AttendanceDataProvider'
import { DEFAULT_FILTERS, type AttendanceFilters } from './lib/filters'
import { LoginPage } from './pages/LoginPage'
import { WorkspaceGatePage } from './pages/WorkspaceGatePage'
import { signOut } from './services/authService'
import type { PersonWithHistory, Section } from './types/records'
import { useI18n } from './i18n'

const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })))
const RegistrationPage = lazy(() => import('./pages/RegistrationPage').then((module) => ({ default: module.RegistrationPage })))
const PeoplePage = lazy(() => import('./pages/PeoplePage').then((module) => ({ default: module.PeoplePage })))
const AttendancesPage = lazy(() => import('./pages/AttendancesPage').then((module) => ({ default: module.AttendancesPage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))

/** Lo que se abre en "Registrar atención": una persona existente o un nombre nuevo. */
export interface RegistrationTarget {
  person?: PersonWithHistory
  name?: string
}

export function WorkspaceApp() {
  const { t } = useI18n()
  const [section, setSection] = useState<Section>('home')
  const [registration, setRegistration] = useState<RegistrationTarget>({})
  const [registrationKey, setRegistrationKey] = useState(0)
  const [openPersonId, setOpenPersonId] = useState<string>()
  // Atenciones e Informes comparten filtros: al pasar de una a otra se ve el mismo conjunto.
  const [filters, setFilters] = useState<AttendanceFilters>(DEFAULT_FILTERS)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const { user } = useAuth()
  const { access } = useWorkspace()
  const canManageWorkspace = access.status === 'active' && access.membership.role === 'admin'
  const metadataName = user?.user_metadata?.full_name
  const userName = typeof metadataName === 'string' && metadataName.trim()
    ? metadataName.trim()
    : user?.email?.split('@')[0] ?? ''

  const navigate = useCallback((next: Section) => {
    if (next === 'settings' && !canManageWorkspace) return
    if (next === 'new') {
      setRegistration({})
      setRegistrationKey((key) => key + 1)
    }
    setOpenPersonId(undefined)
    setSection(next)
    window.scrollTo({ top: 0 })
  }, [canManageWorkspace])

  const startRegistration = useCallback((target: RegistrationTarget) => {
    setRegistration(target)
    setRegistrationKey((key) => key + 1)
    setOpenPersonId(undefined)
    setSection('new')
    window.scrollTo({ top: 0 })
  }, [])

  const openPerson = useCallback((personId: string) => setOpenPersonId(personId), [])
  const closePerson = useCallback(() => setOpenPersonId(undefined), [])

  async function handleSignOut() {
    setSigningOut(true)
    setSignOutError('')
    try {
      await signOut()
    } catch (error: unknown) {
      setSignOutError(error instanceof Error ? error.message : 'No se pudo cerrar la sesión.')
    } finally {
      setSigningOut(false)
    }
  }

  function renderPage() {
    switch (section) {
      case 'new':
        return (
          <RegistrationPage
            initialName={registration.name}
            key={registrationKey}
            onOpenPerson={openPerson}
            onRegisterAnother={() => startRegistration({})}
            selectedPerson={registration.person}
          />
        )
      case 'people':
        return <PeoplePage onOpenPerson={openPerson} onRegister={startRegistration} />
      case 'attendances':
        return <AttendancesPage filters={filters} onFiltersChange={setFilters} onOpenPerson={openPerson} />
      case 'reports':
        return <ReportsPage filters={filters} onFiltersChange={setFilters} onNavigate={navigate} />
      case 'settings':
        return canManageWorkspace
          ? <SettingsPage />
          : <HomePage onNavigate={navigate} onOpenPerson={openPerson} onRegister={startRegistration} />
      case 'home':
        return <HomePage onNavigate={navigate} onOpenPerson={openPerson} onRegister={startRegistration} />
    }
  }

  return (
    <AttendanceDataProvider>
      <AppShell
        canManageWorkspace={canManageWorkspace}
        onNavigate={navigate}
        onSignOut={() => void handleSignOut()}
        roleLabel={canManageWorkspace ? 'Administrador' : 'Colaborador'}
        section={section === 'settings' && !canManageWorkspace ? 'home' : section}
        signOutError={signOutError}
        signingOut={signingOut}
        userEmail={user?.email ?? undefined}
        userName={userName}
      >
        <Suspense fallback={<p className="loading" role="status">{t('Cargando…')}</p>}>
          {renderPage()}
        </Suspense>
      </AppShell>
      {openPersonId && (
        <PersonDrawer
          onClose={closePerson}
          onRegister={(person) => startRegistration({ person })}
          personId={openPersonId}
        />
      )}
    </AttendanceDataProvider>
  )
}

function App() {
  const { t } = useI18n()
  const { configured, loading, session, passwordRecovery } = useAuth()
  const { access } = useWorkspace()

  if (loading) {
    return <div className="splash"><p className="loading" role="status">{t('Verificando sesión…')}</p></div>
  }

  if (!configured || !session || passwordRecovery) return <LoginPage />

  if (access.status === 'loading' || access.status === 'no-session') {
    return <div className="splash"><p className="loading" role="status">{t('Comprobando tu acceso…')}</p></div>
  }

  if (access.status !== 'active') return <WorkspaceGatePage />

  return <WorkspaceApp />
}

export default App
