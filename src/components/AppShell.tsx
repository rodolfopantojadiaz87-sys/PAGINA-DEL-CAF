import {
  ChartNoAxesCombined,
  FileText,
  Home,
  LogOut,
  Search,
  Settings,
  UserRoundPlus,
  UsersRound,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { Section } from '../types/records'

const navigation: { id: Section; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Inicio', icon: Home },
  { id: 'new', label: 'Nuevo registro', icon: UserRoundPlus },
  { id: 'search', label: 'Buscar personas', icon: Search },
  { id: 'people', label: 'Personas registradas', icon: UsersRound },
  { id: 'statistics', label: 'Estadísticas', icon: ChartNoAxesCombined },
  { id: 'reports', label: 'Informes semestrales', icon: FileText },
  { id: 'settings', label: 'Configuración', icon: Settings },
]

const mobileLabels: Record<Section, string> = {
  home: 'Inicio',
  new: 'Nuevo',
  search: 'Buscar',
  people: 'Personas',
  statistics: 'Estad.',
  reports: 'Informes',
  settings: 'Ajustes',
}

interface AppShellProps {
  section: Section
  canManageWorkspace: boolean
  onNavigate: (section: Section) => void
  userEmail?: string
  onSignOut?: () => void
  signingOut?: boolean
  signOutError?: string
  children: ReactNode
}

export function AppShell({
  section,
  canManageWorkspace,
  onNavigate,
  userEmail,
  onSignOut,
  signingOut = false,
  signOutError,
  children,
}: AppShellProps) {
  const visibleNavigation = canManageWorkspace
    ? navigation
    : navigation.filter((item) => item.id !== 'settings')
  const active = visibleNavigation.find((item) => item.id === section) ?? visibleNavigation[0]
  const [today] = useState(() => new Date())

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => onNavigate('home')} type="button">
          <span className="brand__mark">RA</span>
          <span className="brand__text">
            <strong>Atenciones</strong>
            <small>Registro personal</small>
          </span>
        </button>
        <p className="sidebar__label">MENÚ PRINCIPAL</p>
        <nav className="sidebar__nav" aria-label="Navegación principal">
          {visibleNavigation.map(({ id, label, icon: Icon }) => (
            <button
              aria-current={section === id ? 'page' : undefined}
              className={`nav-link${section === id ? ' nav-link--active' : ''}`}
              key={id}
              onClick={() => onNavigate(id)}
              type="button"
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar__footer">
          <span className="privacy-dot" />
          <span>Espacio compartido protegido</span>
        </div>
      </aside>
      <div className="app-shell__main">
        <header className="topbar">
          <div className="topbar__mobile-brand">
            <span className="brand__mark">RA</span>
            <strong>Atenciones</strong>
          </div>
          <span className="topbar__section">{active.label}</span>
          <span className="topbar__date">
            {today.toLocaleDateString('es', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
          {userEmail && <span className="topbar__user">{userEmail}</span>}
          {onSignOut && (
            <button
              aria-label="Cerrar sesión"
              className="topbar__signout"
              disabled={signingOut}
              onClick={onSignOut}
              title="Cerrar sesión"
              type="button"
            >
              <LogOut size={17} />
              <span>{signingOut ? 'Saliendo…' : 'Salir'}</span>
            </button>
          )}
        </header>
        {signOutError && <p className="form-message form-message--error topbar__error" role="alert">{signOutError}</p>}
        <main className="page-content">{children}</main>
      </div>
      <nav
        className="mobile-nav"
        aria-label="Navegación móvil"
        style={{ gridTemplateColumns: `repeat(${visibleNavigation.length}, minmax(0, 1fr))` }}
      >
        {visibleNavigation.map(({ id, icon: Icon }) => (
          <button
            aria-current={section === id ? 'page' : undefined}
            className={section === id ? 'mobile-nav__item mobile-nav__item--active' : 'mobile-nav__item'}
            key={id}
            onClick={() => onNavigate(id)}
            type="button"
          >
            <Icon size={20} />
            <span>{mobileLabels[id]}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
