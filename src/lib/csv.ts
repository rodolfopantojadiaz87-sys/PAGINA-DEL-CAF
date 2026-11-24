/**
 * Genera y descarga un CSV que Excel abre bien en español y portugués:
 * separador ";" y BOM UTF-8 para conservar tildes.
 */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]): void {
  const escape = (value: string | number) => {
    const text = String(value)
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const content = [header, ...rows].map((row) => row.map(escape).join(';')).join('\r\n')
  downloadBlob(filename, new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' }))
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
