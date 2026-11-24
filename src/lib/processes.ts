import type { ProcessType } from '../types/records'

/**
 * Cada proceso tiene un color propio. Es el único código de color de la aplicación:
 * se usa en etiquetas, selectores, gráficos y en el PDF.
 */
export const PROCESS_COLORS: Record<ProcessType, string> = {
  RESIDENCIA: '#2F5BD3',
  CPF: '#0E7C66',
  RNM: '#6E45C4',
  RENOVACION: '#A86400',
  'CAMBIO DE DIRECCION': '#C0412A',
  'ELABORACION DE CURRICULUM': '#A62B66',
  DESARCHIVAR: '#4F5B70',
}

export function processColor(process: string): string {
  return PROCESS_COLORS[process as ProcessType] ?? '#4F5B70'
}
