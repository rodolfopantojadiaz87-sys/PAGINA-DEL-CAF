import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ReportSummary } from '../statistics/aggregates'
import { colorForNationality } from '../services/nationalityColors'
import type { NationalityColor } from '../types/records'
import { getLocale, getProcessLabel, translateText, type Language } from '../i18n'

function drawBarChart(
  doc: jsPDF,
  title: string,
  items: ReportSummary['nationalities'],
  top: number,
  nationalityColors: NationalityColor[],
  language: Language,
): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(title, 14, top)
  if (!items.length) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(translateText('Sin datos para este período.', language), 14, top + 10)
    return top + 20
  }
  const max = Math.max(...items.map((row) => row.count), 1)
  const chartWidth = 96
  let y = top + 9
  items.forEach(({ label, count, percentage }) => {
    if (y + 6 > 282) {
      doc.addPage()
      y = 20
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(`${title} (${translateText('continuación', language)})`, 14, y)
      y += 9
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(getProcessLabel(label, language).slice(0, 28), 14, y + 3.5)
    doc.setFillColor(232, 239, 233)
    doc.roundedRect(82, y, chartWidth, 5, 1, 1, 'F')
    const color = nationalityColors.length
      ? colorForNationality(label, nationalityColors)
      : '#4B7755'
    const red = Number.parseInt(color.slice(1, 3), 16)
    const green = Number.parseInt(color.slice(3, 5), 16)
    const blue = Number.parseInt(color.slice(5, 7), 16)
    doc.setFillColor(red, green, blue)
    doc.roundedRect(82, y, Math.max((count / max) * chartWidth, 1), 5, 1, 1, 'F')
    doc.setTextColor(50, 64, 54)
    doc.text(String(count), 182, y + 3.5)
    doc.text(`${percentage.toFixed(1)}%`, 194, y + 3.5)
    y += 8
  })
  doc.setTextColor(0, 0, 0)
  return y + 4
}

export function buildSemesterReport(
  summary: ReportSummary,
  nationalityColors: NationalityColor[] = [],
  language: Language = 'es',
): Blob {
  const doc = new jsPDF()
  const semesterName = translateText(
    summary.semester === 1
      ? 'Primer semestre (enero a junio)'
      : 'Segundo semestre (julio a diciembre)',
    language,
  )
  const generated = new Date().toLocaleDateString(getLocale(language))

  doc.setFillColor(36, 57, 42)
  doc.rect(0, 0, 210, 45, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(19)
  doc.text(translateText('Informe semestral de atenciones', language), 14, 19)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`${semesterName} · ${summary.year}`, 14, 29)
  doc.text(`${translateText('Generado el', language)} ${generated}`, 14, 36)

  doc.setTextColor(53, 87, 62)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(translateText('TOTAL GENERAL DE PERSONAS ATENDIDAS', language), 14, 57)
  doc.setFontSize(30)
  doc.text(String(summary.peopleCount), 14, 72)
  doc.setTextColor(50, 60, 53)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`${translateText('Atenciones realizadas:', language)} ${summary.appointmentCount}`, 55, 63)
  doc.text(`${translateText('Procesos realizados:', language)} ${summary.processCount}`, 55, 71)

  autoTable(doc, {
    startY: 83,
    head: [[
      translateText('Nacionalidad', language),
      translateText('Personas', language),
      translateText('Porcentaje', language),
    ]],
    body: summary.nationalities.map((item) => [item.label, item.count, `${item.percentage.toFixed(1)}%`]),
    headStyles: { fillColor: [60, 94, 67] },
    styles: { fontSize: 9, cellPadding: 2.5 },
    theme: 'striped',
  })
  const nationalityEnd = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 90
  autoTable(doc, {
    startY: nationalityEnd + 8,
    head: [[
      translateText('Proceso', language),
      translateText('Veces realizado', language),
      translateText('Porcentaje', language),
    ]],
    body: summary.processes.map((item) => [
      getProcessLabel(item.label, language),
      item.count,
      `${item.percentage.toFixed(1)}%`,
    ]),
    headStyles: { fillColor: [60, 94, 67] },
    styles: { fontSize: 9, cellPadding: 2.5 },
    theme: 'striped',
  })

  doc.addPage()
  doc.setTextColor(0, 0, 0)
  let chartBottom = drawBarChart(
    doc,
    translateText('Personas atendidas por nacionalidad', language),
    summary.nationalities,
    20,
    nationalityColors,
    language,
  )
  chartBottom += 12
  drawBarChart(
    doc,
    translateText('Procesos realizados', language),
    summary.processes,
    chartBottom,
    [],
    language,
  )
  return doc.output('blob')
}

export function getReportFile(
  summary: ReportSummary,
  nationalityColors: NationalityColor[] = [],
  language: Language = 'es',
): File {
  const filename = `${language === 'pt' ? 'relatorio' : 'informe'}-${summary.year}-semestre-${summary.semester}.pdf`
  return new File(
    [buildSemesterReport(summary, nationalityColors, language)],
    filename,
    { type: 'application/pdf' },
  )
}
