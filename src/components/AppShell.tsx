import {
  ChartNoAxesCombined,
  Home,
  LogOut,
  Plus,
  Search,
  Settings,
  UsersRound,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { Section } from '../types/records'
import { getLocale, useI18n } from '../i18n'
import { LanguageSwitcher } from './LanguageSwitcher'

const navigation: { id: Section; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Inicio', icon: Home },
  { id: 'search', label: 'Buscar personas', icon: Search },
  { id: 'people', label: 'Personas registradas', icon: UsersRound },
  { id: 'reports', label: 'Estadísticas e informes', icon: ChartNoAxesCombined },
  { id: 'settings', label: 'Configuración', icon: Settings },
]

const mobileLabels: Record<Section, string> = {
  home: 'Inicio',
  new: 'Nuevo',
  search: 'Buscar',
  people: 'Personas',
  reports: 'Estad. e informes',
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
  const { language, t } = useI18n()
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
            <strong>{t('Atenciones')}</strong>
            <small>{t('Registro personal')}</small>
          </span>
        </button>
        <p className="sidebar__label">{t('MENÚ PRINCIPAL')}</p>
        <nav className="sidebar__nav" aria-label={t('Navegación principal')}>
          {visibleNavigation.map(({ id, label, icon: Icon }) => (
            <button
              aria-current={section === id ? 'page' : undefined}
              className={`nav-link${section === id ? ' nav-link--active' : ''}`}
              key={id}
              onClick={() => onNavigate(id)}
              type="button"
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{t(label)}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar__footer">
          <span className="privacy-dot" />
          <span>{t('Espacio compartido protegido')}</span>
        </div>
      </aside>
      <div className="app-shell__main">
        <header className="topbar">
          <div className="topbar__mobile-brand">
            <span className="brand__mark">RA</span>
            <strong>{t('Atenciones')}</strong>
          </div>
          <span className="topbar__section">{t(section === 'new' ? 'Nuevo caso' : active.label)}</span>
          <span className="topbar__date">
            {today.toLocaleDateString(getLocale(language), {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
          <LanguageSwitcher />
          {userEmail && <span className="topbar__user">{userEmail}</span>}
          {onSignOut && (
            <button
              aria-label={t('Cerrar sesión')}
              className="topbar__signout"
              disabled={signingOut}
              onClick={onSignOut}
              title={t('Cerrar sesión')}
              type="button"
            >
              <LogOut size={17} />
              <span>{signingOut ? t('Saliendo…') : t('Salir')}</span>
            </button>
          )}
        </header>
        {signOutError && <p className="form-message form-message--error topbar__error" role="alert">{t(signOutError)}</p>}
        <main className="page-content">{children}</main>
      </div>
      <nav
        className="mobile-nav"
        aria-label={t('Navegación móvil')}
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
            <span>{t(mobileLabels[id])}</span>
          </button>
        ))}
      </nav>
      {section !== 'new' && (
        <button
          aria-label={t('Nuevo caso')}
          className="floating-action"
          onClick={() => onNavigate('new')}
          type="button"
        >
          <Plus size={19} />
          <span>{t('Nuevo caso')}</span>
        </button>
      )}
    </div>
  )
}
