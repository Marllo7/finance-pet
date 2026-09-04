export type DateFormatLang = 'ru' | 'en'

/**
 * Форматирует дату YYYY-MM-DD в локализованный формат.
 * ru: DD.MM.YYYY
 * en: MM/DD/YYYY
 */
export function formatDate(dateStr: string, lang: DateFormatLang = 'ru'): string {
  if (!dateStr) return ''
  
  // Парсим YYYY-MM-DD
  const [year, month, day] = dateStr.split('-')
  if (!year || !month || !day) return dateStr

  // Календарная валидация: месяц 1–12, день должен существовать
  const y = Number(year); const m = Number(month); const d = Number(day)
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return dateStr
  if (m < 1 || m > 12 || d < 1 || d > 31) return dateStr
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return dateStr
  
  if (lang === 'ru') {
    return `${day}.${month}.${year}`
  }
  
  // en: MM/DD/YYYY
  return `${month}/${day}/${year}`
}

/**
 * Форматирует дату для отображения в относительном формате.
 * ru: "вчера", "сегодня", "3 дня назад"
 * en: "yesterday", "today", "3 days ago"
 */
export function formatDateRelative(dateStr: string, lang: DateFormatLang = 'ru'): string {
  if (!dateStr) return ''
  
  // Сравнение по календарным ЛОКАЛЬНЫМ дням: YYYY-MM-DD парсим как локальную полночь
  const parts = dateStr.split('-')
  if (parts.length < 3) return formatDate(dateStr, lang)
  const y = Number(parts[0]); const m = Number(parts[1]); const d = Number(parts[2])
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return formatDate(dateStr, lang)
  const target = new Date(y, m - 1, d)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return lang === 'ru' ? 'сегодня' : 'today'
  if (diffDays === 1) return lang === 'ru' ? 'вчера' : 'yesterday'
  if (diffDays === -1) return lang === 'ru' ? 'завтра' : 'tomorrow'
  // Будущее дальше завтра — возвращаем саму дату, а не «завтра»
  if (diffDays < 0) return formatDate(dateStr, lang)
  
  // Относительно — до 2 недель (покрывает склонения 11/12/13), дальше — сама дата
  if (diffDays < 14) {
    return lang === 'ru'
      ? `${diffDays} ${declineDays(diffDays)} назад`
      : `${diffDays} days ago`
  }
  
  return formatDate(dateStr, lang)
}

function declineDays(n: number): string {
  const ru = ['день', 'дня', 'дней']
  const abs = Math.abs(n) % 100
  const lastDigit = abs % 10
  
  if (abs >= 11 && abs <= 19) return ru[2]
  if (lastDigit === 1) return ru[0]
  if (lastDigit >= 2 && lastDigit <= 4) return ru[1]
  return ru[2]
}
