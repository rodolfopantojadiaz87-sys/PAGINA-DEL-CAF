import {
  ChartColumn,
  ChevronsUpDown,
  ClipboardList,
  Home,
  Languages,
  LogOut,
  Plus,
  UserCog,
  UsersRound,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Section } from '../types/records'
import { useI18n } from '../i18n'
import { FormAlert } from './FormAlert'

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
  const { language, setLanguage, t } = useI18n()
  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toLocaleUpperCase())
    .join('')

  function renderGroup(title: string, items: NavItem[]) {
    return (
      <div className="space-y-1">
        <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">{t(title)}</p>
        {items.map(({ id, label, icon: Icon }) => (
          <button
            aria-current={section === id ? 'page' : undefined}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              section === id && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
            )}
            key={id}
            onClick={() => onNavigate(id)}
            type="button"
          >
            <Icon className="size-4" aria-hidden="true" />
            <span>{t(label)}</span>
          </button>
        ))}
      </div>
    )
  }

  function accountMenu(compact: boolean) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t('Tu cuenta')}
          className={cn(
            'flex items-center gap-2 rounded-md text-left outline-none hover:bg-sidebar-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
            compact ? 'p-1' : 'w-full p-2',
          )}
        >
          <Avatar className="size-8 rounded-lg">
            <AvatarFallback className="rounded-lg bg-primary text-xs font-medium text-primary-foreground">{initials || '?'}</AvatarFallback>
          </Avatar>
          {!compact && (
            <>
              <span className="grid flex-1 text-sm leading-tight">
                <span className="truncate font-medium">{userName}</span>
                <span className="truncate text-xs text-muted-foreground">{t(roleLabel)}</span>
              </span>
              <ChevronsUpDown className="size-4 text-muted-foreground" aria-hidden="true" />
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={compact ? 'end' : 'start'} className="w-60" side={compact ? 'bottom' : 'top'}>
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium">{userName}</p>
            {userEmail && <p className="truncate text-xs text-muted-foreground">{userEmail}</p>}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger><Languages className="mr-2 size-4 text-muted-foreground" aria-hidden="true" />{t('Idioma')}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup onValueChange={(value) => setLanguage(value === 'pt' ? 'pt' : 'es')} value={language}>
                <DropdownMenuRadioItem value="es">{t('Español')}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="pt">{t('Português')}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {canManageWorkspace && (
            <DropdownMenuItem onSelect={() => onNavigate('settings')}>
              <UserCog aria-hidden="true" />{t('Miembros')}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={signingOut} onSelect={onSignOut}>
            <LogOut aria-hidden="true" />{signingOut ? t('Saliendo…') : t('Cerrar sesión')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const brand = (size: number) => (
    <button className="flex items-center gap-2.5 rounded-md p-1 text-left" onClick={() => onNavigate('home')} type="button">
      <img alt="" className="rounded-lg" height={size} src="/icons/icon-192.png" width={size} />
      <span className="grid leading-tight">
        <span className="text-sm font-semibold">Novo Norte</span>
        {size > 32 && <span className="text-xs text-muted-foreground">{t('Registro de atenciones')}</span>}
      </span>
    </button>
  )

  const mobileItems = [DAILY[0], DAILY[2], DAILY[1], DAILY[3], ANALYSIS[0]]

  return (
    <div className="min-h-screen bg-muted/40 lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r bg-sidebar p-3 lg:flex">
        {brand(36)}
        <nav aria-label={t('Navegación principal')} className="flex-1 space-y-6">
          {renderGroup('Día a día', DAILY)}
          {renderGroup('Análisis', ANALYSIS)}
          {canManageWorkspace && renderGroup('Administración', ADMIN)}
        </nav>
        {accountMenu(false)}
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:hidden">
        {brand(30)}
        {accountMenu(true)}
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:py-10" id="contenido">
        {signOutError && <FormAlert>{t(signOutError)}</FormAlert>}
        {children}
      </main>

      <nav aria-label={t('Navegación')} className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {mobileItems.map(({ id, short, icon: Icon }) => (
          <button
            aria-current={section === id ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground',
              section === id && 'font-medium text-foreground',
            )}
            key={id}
            onClick={() => onNavigate(id)}
            type="button"
          >
            {id === 'new' ? (
              <span className="-mt-5 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                <Icon className="size-5" aria-hidden="true" />
              </span>
            ) : (
              <Icon className="size-5" aria-hidden="true" />
            )}
            <span>{t(short)}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
