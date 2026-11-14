import { database } from '../database/database'
import type { CountItem } from '../statistics/aggregates'
import type { NationalityColor } from '../types/records'

const DISTINCT_PALETTE = [
  '#0072B2',
  '#D55E00',
  '#009E73',
  '#CC79A7',
  '#E69F00',
  '#56B4E9',
  '#6F4E7C',
  '#4E79A7',
  '#F28E2B',
  '#59A14F',
  '#E15759',
  '#76B7B2',
  '#EDC948',
  '#B07AA1',
  '#FF9DA7',
  '#9C755F',
  '#BAB0AC',
  '#2F6B4F',
  '#8A5A00',
  '#315C91',
]

function nationalityKey(label: string): string {
  return label.trim().toLocaleLowerCase()
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const section = hue / 60
  const secondary = chroma * (1 - Math.abs((section % 2) - 1))
  const offset = lightness - chroma / 2
  const [red, green, blue] =
    section < 1
      ? [chroma, secondary, 0]
      : section < 2
        ? [secondary, chroma, 0]
        : section < 3
          ? [0, chroma, secondary]
          : section < 4
            ? [0, secondary, chroma]
            : section < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary]
  return `#${[red, green, blue]
    .map((channel) =>
      Math.round((channel + offset) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`
}

function generatedColor(slot: number): string {
  const generatedSlot = slot - DISTINCT_PALETTE.length
  const hue = (generatedSlot * 137.508 + 18) % 360
  const saturation = [0.72, 0.62, 0.82][Math.floor(generatedSlot / 360) % 3]
  const lightness = [0.42, 0.34, 0.5][Math.floor(generatedSlot / 1080) % 3]
  return hslToHex(hue, saturation, lightness)
}

export async function ensureNationalityColors(
  labels: string[],
): Promise<NationalityColor[]> {
  return database.transaction('rw', database.nationalityColors, async () => {
    const saved = await database.nationalityColors.toArray()
    const savedByKey = new Map(
      saved.map((entry) => [entry.nationality, entry]),
    )
    const usedColors = new Set(saved.map((entry) => entry.color.toUpperCase()))
    let nextSlot = Math.max(-1, ...saved.map(({ slot }) => slot)) + 1
    const uniqueLabels = new Map<string, string>()

    for (const label of labels) {
      const cleanLabel = label.trim() || 'Sin especificar'
      const key = nationalityKey(cleanLabel)
      if (key && !uniqueLabels.has(key)) uniqueLabels.set(key, cleanLabel)
    }

    for (const [nationality, label] of uniqueLabels) {
      const existing = savedByKey.get(nationality)
      if (existing) {
        if (existing.label !== label) {
          existing.label = label
          await database.nationalityColors.put(existing)
        }
        continue
      }

      let color =
        nextSlot < DISTINCT_PALETTE.length
          ? DISTINCT_PALETTE[nextSlot]
          : generatedColor(nextSlot)
      while (usedColors.has(color.toUpperCase())) {
        nextSlot += 1
        color = generatedColor(nextSlot)
      }

      const entry = { nationality, label, color, slot: nextSlot }
      await database.nationalityColors.add(entry)
      savedByKey.set(nationality, entry)
      usedColors.add(color.toUpperCase())
      nextSlot += 1
    }

    return [...uniqueLabels.keys()]
      .map((key) => savedByKey.get(key))
      .filter((entry): entry is NationalityColor => entry !== undefined)
  })
}

export function colorsForNationalities(
  items: CountItem[],
  entries: NationalityColor[],
): Record<string, string> {
  const saved = new Map(entries.map(({ nationality, color }) => [nationality, color]))
  return Object.fromEntries(
    items.map((item) => [
      item.label,
      saved.get(nationalityKey(item.label)) ?? '#60746A',
    ]),
  )
}

export function colorForNationality(
  label: string,
  entries: NationalityColor[],
): string {
  return entries.find((entry) => entry.nationality === nationalityKey(label))?.color
    ?? '#60746A'
}
