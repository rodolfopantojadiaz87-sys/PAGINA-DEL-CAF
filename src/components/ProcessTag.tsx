import type { CSSProperties } from 'react'
import { getProcessLabel, useI18n } from '../i18n'
import { processColor } from '../lib/processes'

export function ProcessTag({ process }: { process: string }) {
  const { language } = useI18n()
  return (
    <span className="process-tag" style={{ '--process-color': processColor(process) } as CSSProperties}>
      {getProcessLabel(process, language)}
    </span>
  )
}
