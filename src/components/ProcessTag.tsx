import { Badge } from '@/components/ui/badge'
import { getProcessLabel, useI18n } from '../i18n'
import { processColor } from '../lib/processes'

export function ProcessTag({ process }: { process: string }) {
  const { language } = useI18n()
  return (
    <Badge className="gap-1.5 font-normal" variant="outline">
      <span aria-hidden="true" className="size-2 rounded-full" style={{ background: processColor(process) }} />
      {getProcessLabel(process, language)}
    </Badge>
  )
}
