import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from '../i18n'
import { LanguageSwitcher } from './LanguageSwitcher'

interface AuthLayoutProps {
  title: string
  description: ReactNode
  children: ReactNode
}

/** Pantallas sin sesión o sin acceso: tarjeta centrada con la marca. */
export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="flex items-center justify-between p-4 sm:p-6">
        <div className="flex items-center gap-2.5">
          <img alt="" className="rounded-lg" height="36" src="/icons/icon-192.png" width="36" />
          <span className="grid leading-tight">
            <span className="text-sm font-semibold">Novo Norte</span>
            <span className="text-xs text-muted-foreground">{t('Registro de atenciones')}</span>
          </span>
        </div>
        <LanguageSwitcher />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center sm:pt-0">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl"><h1>{title}</h1></CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </main>
    </div>
  )
}
