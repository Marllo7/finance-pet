/**
 * Парсинг денежной суммы из строки.
 * Возвращает число или null, если ввод некорректен или сумма <= 0.
 */
export function parseAmount(raw: string): number | null {
  if (typeof raw !== 'string') return null
  // Убираем пробелы, включая неразрывные (nbsp, thin/narrow nbsp)
  const noSpaces = raw.replace(/[\s\u00A0\u2007\u202F\u2009]/g, '')
  if (!noSpaces) return null
  // Отклоняем экспоненты и hex
  if (/[eExX]/.test(noSpaces)) return null

  const hasComma = noSpaces.includes(',')
  const hasDot = noSpaces.includes('.')

  let normalized: string
  if (hasComma && hasDot) {
    // Десятичным считается ПОСЛЕДНИЙ из разделителей, остальные — тысячные
    const lastComma = noSpaces.lastIndexOf(',')
    const lastDot = noSpaces.lastIndexOf('.')
    const lastSep = Math.max(lastComma, lastDot)
    const fracLen = noSpaces.length - lastSep - 1
    const stripped = noSpaces.replace(/[,.]/g, '')
    normalized = fracLen > 0
      ? stripped.slice(0, stripped.length - fracLen) + '.' + stripped.slice(stripped.length - fracLen)
      : stripped
  } else if (hasComma) {
    // Только запятые: последняя — десятичная, остальные — тысячные
    const lastComma = noSpaces.lastIndexOf(',')
    const fracLen = noSpaces.length - lastComma - 1
    const stripped = noSpaces.replace(/,/g, '')
    normalized = fracLen > 0
      ? stripped.slice(0, stripped.length - fracLen) + '.' + stripped.slice(stripped.length - fracLen)
      : stripped
  } else if (hasDot) {
    // Только точки: последняя — десятичная (покрывает и "1.000.50")
    const parts = noSpaces.split('.')
    normalized = parts.length > 2
      ? parts.slice(0, -1).join('') + '.' + parts[parts.length - 1]
      : noSpaces
  } else {
    normalized = noSpaces
  }

  const value = Number(normalized)
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}
