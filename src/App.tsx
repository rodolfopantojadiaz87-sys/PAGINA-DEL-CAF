import { lazy, Suspense, useState } from 'react'
import './App.css'
import { useAuth } from './auth/useAuth'
import { useWorkspace } from './auth/useWorkspace'
import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/LoginPage'
import { WorkspaceGatePage } from './pages/WorkspaceGatePage'
import { signOut } from './services/authService'
import type { Person, Section } from './types/records'
import { useI18n } from './i18n'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const PeoplePage = lazy(() => import('./pages/PeoplePage').then((module) => ({ default: module.PeoplePage })))
const RegistrationPage = lazy(() => import('./pages/RegistrationPage').then((module) => ({ default: module.RegistrationPage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })))
const SearchPage = lazy(() => import('./pages/SearchPage').then((module) => ({ default: module.SearchPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))

export function WorkspaceApp() {
  const { t } = useI18n()
  const [section, setSection] = useState<Section>('home')
  const [selectedPerson, setSelectedPerson] = useState<Person>()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const { user } = useAuth()
  const { access } = useWorkspace()
  const canManageWorkspace =
    access.status === 'active' && access.membership.role === 'admin'

  function navigate(next: Section) {
    if (next === 'settings' && !canManageWorkspace) return
    if (next !== 'new') setSelectedPerson(undefined)
    setSection(next)
  }

  function selectPerson(person: Person) {
    setSelectedPerson(person)
    setSection('new')
  }

  function clearSelectedPerson() {
    setSelectedPerson(undefined)
  }

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
        return <RegistrationPage key={selectedPerson?.id ?? 'new'} selectedPerson={selectedPerson} onClearSelectedPerson={clearSelectedPerson} onCancel={() => navigate('home')} />
      case 'search':
        return <SearchPage onSelectPerson={selectPerson} />
      case 'people':
        return <PeoplePage />
      case 'reports':
        return <ReportsPage />
      case 'settings':
        return canManageWorkspace
          ? <SettingsPage />
          : <DashboardPage onNavigate={navigate} />
      case 'home':
        return <DashboardPage onNavigate={navigate} />
    }
  }

  return (
    <AppShell
      section={section === 'settings' && !canManageWorkspace ? 'home' : section}
      canManageWorkspace={canManageWorkspace}
      onNavigate={navigate}
      userEmail={user?.email ?? undefined}
      onSignOut={() => void handleSignOut()}
      signingOut={signingOut}
      signOutError={signOutError}
    >
      <Suspense fallback={<div className="loading-state" role="status">{t('Cargando sección…')}</div>}>
        {renderPage()}
      </Suspense>
    </AppShell>
  )
}

function App() {
  const { t } = useI18n()
  const { configured, loading, session, passwordRecovery } = useAuth()
  const { access } = useWorkspace()

  if (loading) {
    return <div className="auth-page"><div className="loading-state" role="status">{t('Verificando sesión…')}</div></div>
  }

  if (!configured || !session || passwordRecovery) return <LoginPage />

  if (access.status === 'loading' || access.status === 'no-session') {
    return <div className="auth-page"><div className="loading-state" role="status">{t('Verificando membresía…')}</div></div>
  }

  if (access.status !== 'active') return <WorkspaceGatePage />

  return <WorkspaceApp />
}

export default App
