import type { ReactNode } from 'react'

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
      <p className="max-w-md">{children}</p>
      {action}
    </div>
  )
}
