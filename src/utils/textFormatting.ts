const WORD_START = /(^|[\s'’\u2010-\u2015-])(\p{L})/gu

export function capitalizeWords(value: string): string {
  return value.replace(
    WORD_START,
    (_match, separator: string, letter: string) =>
      `${separator}${letter.toLocaleUpperCase()}`,
  )
}
