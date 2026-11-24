import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

export function PersonAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <Avatar aria-hidden="true" className={cn('size-9', className)}>
      <AvatarFallback className="text-sm font-medium">
        {name.trim().slice(0, 1).toLocaleUpperCase() || '?'}
      </AvatarFallback>
    </Avatar>
  )
}
