import { describe, it, expect } from 'vitest'
import { formatDate, formatDateRelative } from '../../utils/formatDate'
import { toLocalDateStr } from '../../types/date'

function localDateStr(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return toLocalDateStr(d)
}

describe('formatDate', () => {
  it('should format date in Russian format DD.MM.YYYY', () => {
    expect(formatDate('2026-09-01', 'ru')).toBe('01.09.2026')
    expect(formatDate('2026-01-15', 'ru')).toBe('15.01.2026')
    expect(formatDate('2025-12-31', 'ru')).toBe('31.12.2025')
  })

  it('should format date in English format MM/DD/YYYY', () => {
    expect(formatDate('2026-09-01', 'en')).toBe('09/01/2026')
    expect(formatDate('2026-01-15', 'en')).toBe('01/15/2026')
    expect(formatDate('2025-12-31', 'en')).toBe('12/31/2025')
  })

  it('should return empty string for empty input', () => {
    expect(formatDate('', 'ru')).toBe('')
    expect(formatDate('', 'en')).toBe('')
  })

  it('should handle invalid format gracefully', () => {
    expect(formatDate('invalid', 'ru')).toBeDefined()
    expect(typeof formatDate('invalid', 'ru')).toBe('string')
  })
})

describe('formatDateRelative', () => {
  it('should return "today" for today\'s date', () => {
    const today = localDateStr(0)
    expect(formatDateRelative(today, 'ru')).toBe('сегодня')
    expect(formatDateRelative(today, 'en')).toBe('today')
  })

  it('should return "yesterday" for yesterday\'s date', () => {
    const yesterday = localDateStr(-1)
    expect(formatDateRelative(yesterday, 'ru')).toBe('вчера')
    expect(formatDateRelative(yesterday, 'en')).toBe('yesterday')
  })

  it('should decline days correctly in Russian', () => {
    const twoDaysAgo = localDateStr(-2)
    const fiveDaysAgo = localDateStr(-5)
    
    expect(formatDateRelative(twoDaysAgo, 'ru')).toMatch(/2 дня назад/)
    expect(formatDateRelative(fiveDaysAgo, 'ru')).toMatch(/5 дней назад/)
  })

  it('should return tomorrow only for +1 day', () => {
    expect(formatDateRelative(localDateStr(1), 'ru')).toBe('завтра')
    expect(formatDateRelative(localDateStr(1), 'en')).toBe('tomorrow')
  })

  it('should return the date itself for future beyond tomorrow', () => {
    const future = localDateStr(30)
    expect(formatDateRelative(future, 'ru')).toBe(formatDate(future, 'ru'))
    expect(formatDateRelative(future, 'en')).toBe(formatDate(future, 'en'))
  })

  it('should decline 11/12/13/14 days correctly', () => {
    expect(formatDateRelative(localDateStr(-11), 'ru')).toMatch(/11 дней назад/)
    expect(formatDateRelative(localDateStr(-12), 'ru')).toMatch(/12 дней назад/)
    expect(formatDateRelative(localDateStr(-13), 'ru')).toMatch(/13 дней назад/)
    expect(formatDateRelative(localDateStr(-14), 'ru')).toBe(formatDate(localDateStr(-14), 'ru'))
  })
})
