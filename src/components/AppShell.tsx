import {
  ChartColumn,
  ClipboardList,
  Home,
  LogOut,
  Plus,
  UserCog,
  UsersRound,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { Section } from '../types/records'
import { useI18n } from '../i18n'
import { LanguageSwitcher } from './LanguageSwitcher'

type NavItem = { id: Section; label: string; short: string; icon: typeof Home }

const DAILY: NavItem[] = [
  { id: 'home', label: 'Inicio', short: 'Inicio', icon: Home },
  { id: 'new', label: 'Registrar atención', short: 'Registrar', icon: Plus },
  { id: 'people', label: 'Personas', short: 'Personas', icon: UsersRound },
  { id: 'attendances', label: 'Atenciones', short: 'Atenciones', icon: ClipboardList },
]
const ANALYSIS: NavItem[] = [
  { id: 'reports', label: 'Informes', short: 'Informes', icon: ChartColumn },
]
const ADMIN: NavItem[] = [
  { id: 'settings', label: 'Miembros', short: 'Miembros', icon: UserCog },
]

interface AppShellProps {
  section: Section
  canManageWorkspace: boolean
  onNavigate: (section: Section) => void
  userName: string
  userEmail?: string
  roleLabel: string
  onSignOut: () => void
  signingOut: boolean
  signOutError?: string
  children: ReactNode
}

export function AppShell({
  section,
  canManageWorkspace,
  onNavigate,
  userName,
  userEmail,
  roleLabel,
  onSignOut,
  signingOut,
  signOutError,
  children,
}: AppShellProps) {
  const { t } = useI18n()
  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toLocaleUpperCase())
    .join('')

  function renderGroup(title: string, items: NavItem[]) {
    return (
      <div className="nav-group">
        <p className="nav-group__title">{t(title)}</p>
        {items.map(({ id, label, icon: Icon }) => (
          <button
            aria-current={section === id ? 'page' : undefined}
            className="nav-link"
            key={id}
            onClick={() => onNavigate(id)}
            type="button"
          >
            <Icon size={18} strokeWidth={2} aria-hidden="true" />
            <span>{t(label)}</span>
          </button>
        ))}
      </div>
    )
  }

  const account = (
    <details className="account">
      <summary aria-label={t('Tu cuenta')}>
        <span className="account__avatar" aria-hidden="true">{initials || '?'}</span>
        <span className="account__name">
          <strong>{userName}</strong>
          <small>{t(roleLabel)}</small>
        </span>
      </summary>
      <div className="account__menu">
        {userEmail && <p className="account__email">{userEmail}</p>}
        <LanguageSwitcher />
        {canManageWorkspace && (
          <button className="account__item" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); onNavigate('settings') }} type="button">
            <UserCog size={16} aria-hidden="true" />{t('Miembros')}
          </button>
        )}
        <button className="account__item" disabled={signingOut} onClick={onSignOut} type="button">
          <LogOut size={16} aria-hidden="true" />{signingOut ? t('Saliendo…') : t('Cerrar sesión')}
        </button>
      </div>
    </details>
  )

  const mobileItems = [DAILY[0], DAILY[2], DAILY[1], DAILY[3], ANALYSIS[0]]

  return (
    <div className="shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => onNavigate('home')} type="button">
          <img alt="" className="brand__logo" height="40" src="/icons/icon-192.png" width="40" />
          <span className="brand__text">
            <strong>Novo Norte</strong>
            <small>{t('Registro de atenciones')}</small>
          </span>
        </button>
        <nav aria-label={t('Navegación principal')} className="sidebar__nav">
          {renderGroup('Día a día', DAILY)}
          {renderGroup('Análisis', ANALYSIS)}
          {canManageWorkspace && renderGroup('Administración', ADMIN)}
        </nav>
        {account}
      </aside>

      <header className="mobile-header">
        <button className="brand brand--compact" onClick={() => onNavigate('home')} type="button">
          <img alt="" className="brand__logo" height="32" src="/icons/icon-192.png" width="32" />
          <strong>Novo Norte</strong>
        </button>
        {account}
      </header>

      <main className="main" id="contenido">
        {signOutError && <p className="message message--error" role="alert">{t(signOutError)}</p>}
        {children}
      </main>

      <nav aria-label={t('Navegación')} className="tabbar">
        {mobileItems.map(({ id, short, icon: Icon }) => (
          <button
            aria-current={section === id ? 'page' : undefined}
            className={id === 'new' ? 'tabbar__item tabbar__item--primary' : 'tabbar__item'}
            key={id}
            onClick={() => onNavigate(id)}
            type="button"
          >
            <Icon size={id === 'new' ? 22 : 20} aria-hidden="true" />
            <span>{t(short)}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
