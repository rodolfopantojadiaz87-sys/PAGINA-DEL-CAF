import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  value: ReactNode
  label: string
  hint?: string
  footer?: ReactNode
  className?: string
}

export function StatCard({ value, label, hint, footer, className }: StatCardProps) {
  return (
    <Card className={cn('gap-0 py-0 shadow-none', className)}>
      <CardContent className="space-y-1 p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        {footer}
      </CardContent>
    </Card>
  )
}
