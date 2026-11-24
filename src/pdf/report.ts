import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getLocale, getProcessLabel, translateText, type Language } from '../i18n'
import { formatDate, formatMonth, localDate } from '../lib/dates'
import { processColor } from '../lib/processes'
import type { AttendanceSummary, CountItem } from '../statistics/aggregates'
import type { Appointment, PersonWithHistory } from '../types/records'

export interface ReportInput {
  summary: AttendanceSummary
  /** Texto del periodo, por ejemplo "Del 01/07/2026 al 31/12/2026". */
  periodText: string
  /** Filtros además del periodo, ya traducidos: "Proceso: CPF, RNM". */
  filterLines: string[]
  generatedBy: string
  language: Language
  /** Si se incluye, se añade el listado detallado de atenciones. */
  detail?: { appointments: Appointment[]; peopleById: Map<string, PersonWithHistory> }
}

const NAVY: [number, number, number] = [27, 47, 107]
const INK: [number, number, number] = [24, 32, 56]
const MUTED: [number, number, number] = [96, 106, 128]
const LINE: [number, number, number] = [220, 226, 238]
const PAGE_BOTTOM = 280
const LEFT = 14
const RIGHT = 196

function hexToRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)) as [number, number, number]
}

/** Construye el PDF del informe con los filtros aplicados. */
export function buildReport(input: ReportInput): Blob {
  const { summary, language } = input
  const tr = (text: string, values?: Record<string, string | number>) => translateText(text, language, values)
  const locale = getLocale(language)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = 0

  function ensureSpace(height: number) {
    if (y + height > PAGE_BOTTOM) {
      doc.addPage()
      y = 20
    }
  }

  function sectionTitle(title: string) {
    ensureSpace(16)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...INK)
    doc.text(title, LEFT, y)
    y += 7
  }

  function bars(items: CountItem[], label: (item: CountItem) => string, color: (item: CountItem) => [number, number, number], emptyText: string) {
    if (!items.length) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...MUTED)
      doc.text(emptyText, LEFT, y)
      y += 10
      return
    }
    const max = Math.max(...items.map(({ count }) => count), 1)
    const barStart = 74
    const barWidth = 92
    for (const item of items) {
      ensureSpace(8)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...INK)
      const text = label(item)
      doc.text(text.length > 34 ? `${text.slice(0, 33)}…` : text, LEFT, y + 3.6)
      doc.setFillColor(238, 241, 248)
      doc.rect(barStart, y, barWidth, 5, 'F')
      doc.setFillColor(...color(item))
      doc.rect(barStart, y, Math.max((item.count / max) * barWidth, 0.8), 5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.text(String(item.count), 170, y + 3.6)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...MUTED)
      doc.text(`${item.percentage.toFixed(1)}%`, RIGHT, y + 3.6, { align: 'right' })
      y += 7.5
    }
    y += 5
  }

  // Cabecera
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, 210, 36, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('caf Novo Norte', LEFT, 12)
  doc.setFontSize(19)
  doc.text(tr('Informe de atenciones'), LEFT, 23)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(input.periodText, LEFT, 30)
  y = 46

  // Filtros y origen
  doc.setTextColor(...MUTED)
  doc.setFontSize(9)
  const filterText = input.filterLines.length
    ? `${tr('Filtros aplicados')}: ${input.filterLines.join('; ')}`
    : tr('Sin filtros además del periodo.')
  const filterRows = doc.splitTextToSize(filterText, RIGHT - LEFT) as string[]
  doc.text(filterRows, LEFT, y)
  y += filterRows.length * 4.4
  doc.text(tr('Generado el {date} por {name}.', { date: formatDate(localDate(), locale), name: input.generatedBy }), LEFT, y)
  y += 10

  // Cifras clave
  const figures: [string, number][] = [
    [tr('Personas atendidas'), summary.peopleCount],
    [tr('Personas nuevas'), summary.newPeopleCount],
    [tr('Atenciones'), summary.appointmentCount],
  ]
  const boxWidth = (RIGHT - LEFT - 8) / 3
  figures.forEach(([label, value], index) => {
    const x = LEFT + index * (boxWidth + 4)
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.3)
    doc.rect(x, y, boxWidth, 22)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(...NAVY)
    doc.text(String(value), x + 5, y + 11)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(label, x + 5, y + 18)
  })
  y += 32

  sectionTitle(tr('Atenciones por proceso'))
  bars(summary.processes, (item) => getProcessLabel(item.label, language), (item) => hexToRgb(processColor(item.label)), tr('Sin datos para este periodo.'))

  sectionTitle(tr('Personas por nacionalidad'))
  bars(summary.nationalities, (item) => item.label, () => NAVY, tr('Sin datos para este periodo.'))

  const tableStyles = {
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' as const },
    styles: { fontSize: 9, cellPadding: 2.2, textColor: INK, lineColor: LINE, lineWidth: 0.1 },
    alternateRowStyles: { fillColor: [246, 248, 252] as [number, number, number] },
    margin: { left: LEFT, right: 210 - RIGHT },
    theme: 'grid' as const,
  }
  const afterTable = () => (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y

  if (summary.months.length) {
    sectionTitle(tr('Atenciones por mes'))
    autoTable(doc, {
      ...tableStyles,
      startY: y,
      head: [[tr('Mes'), tr('Atenciones')]],
      body: summary.months.map(({ month, count }) => [formatMonth(month, locale, 'long'), count]),
      columnStyles: { 1: { halign: 'right', cellWidth: 40 } },
    })
    y = afterTable() + 10
  }

  if (summary.collaborators.length) {
    sectionTitle(tr('Atenciones por colaborador'))
    autoTable(doc, {
      ...tableStyles,
      startY: y,
      head: [[tr('Colaborador'), tr('Atenciones'), tr('Porcentaje')]],
      body: summary.collaborators.map((item) => [item.label, item.count, `${item.percentage.toFixed(1)}%`]),
      columnStyles: { 1: { halign: 'right', cellWidth: 32 }, 2: { halign: 'right', cellWidth: 32 } },
    })
    y = afterTable() + 10
  }

  if (input.detail) {
    const { appointments, peopleById } = input.detail
    sectionTitle(tr('Listado de atenciones'))
    autoTable(doc, {
      ...tableStyles,
      startY: y,
      head: [[tr('Fecha'), tr('Persona'), tr('Nacionalidad'), tr('Proceso'), tr('Atendió')]],
      body: [...appointments]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((appointment) => {
          const person = peopleById.get(String(appointment.personId))
          return [
            formatDate(appointment.date, locale),
            person?.name ?? tr('Persona eliminada'),
            person?.nationality ?? '',
            getProcessLabel(appointment.process, language),
            appointment.creatorName ?? '',
          ]
        }),
      styles: { ...tableStyles.styles, fontSize: 8 },
      columnStyles: { 0: { cellWidth: 22 } },
    })
  }

  // Pie de página en todas las hojas
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text('caf Novo Norte', LEFT, 290)
    doc.text(tr('Página {page} de {pages}', { page, pages }), RIGHT, 290, { align: 'right' })
  }

  return doc.output('blob')
}
