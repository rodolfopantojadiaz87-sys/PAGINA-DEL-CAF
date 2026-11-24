import { downloadBlob } from '../lib/csv'
import type { ReportInput } from './report'

/** Genera el PDF (cargando jsPDF solo cuando hace falta) y lo descarga. */
export async function downloadReport(input: ReportInput, filename: string): Promise<void> {
  const { buildReport } = await import('./report')
  downloadBlob(filename, buildReport(input))
}

/**
 * Comparte el PDF con el menú del sistema (WhatsApp, correo…) cuando el navegador lo permite.
 * Devuelve false si no se puede compartir, para que la pantalla ofrezca descargarlo.
 */
export async function shareReport(input: ReportInput, filename: string, title: string): Promise<boolean> {
  const { buildReport } = await import('./report')
  const file = new File([buildReport(input)], filename, { type: 'application/pdf' })
  if (!navigator.share || !navigator.canShare?.({ files: [file] })) return false
  try {
    await navigator.share({ title, files: [file] })
  } catch (error) {
    if (!(error instanceof Error && error.name === 'AbortError')) throw error
  }
  return true
}
