import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface FormAlertProps {
  kind?: 'error' | 'success' | 'warning'
  children: ReactNode
}

/** Mensaje de error, éxito o aviso dentro de un formulario o una página. */
export function FormAlert({ kind = 'error', children }: FormAlertProps) {
  const Icon = kind === 'success' ? CircleCheck : CircleAlert
  return (
    <Alert
      className={kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : kind === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' : undefined}
      role={kind === 'error' ? 'alert' : 'status'}
      variant={kind === 'error' ? 'destructive' : 'default'}
    >
      <Icon />
      <AlertDescription className={kind === 'error' ? undefined : 'text-inherit'}>{children}</AlertDescription>
    </Alert>
  )
}
