import { describe, it, expect } from 'vitest'
import { formatMoney, formatMoneyWithSign, getCurrency } from '../../utils/currencies'

describe('formatMoney', () => {
  it('keeps the sign of negative amounts', () => {
    const formatted = formatMoney(-1234.5, 'EUR')
    expect(formatted).toMatch(/-/)
    expect(formatted).toContain('1')
  })

  it('formats positive amounts with the currency symbol (soft check)', () => {
    for (const code of ['EUR', 'USD', 'RUB', 'GBP', 'KZT'] as const) {
      const formatted = formatMoney(1234.5, code)
      expect(formatted.includes(getCurrency(code).symbol)).toBe(true)
    }
  })

  it('falls back to EUR for unknown codes', () => {
    const formatted = formatMoney(100, 'XXX' as never)
    expect(formatted.includes(getCurrency('EUR').symbol)).toBe(true)
  })
})

describe('formatMoneyWithSign', () => {
  it('prefixes income with "+ " and expense with "- "', () => {
    const income = formatMoneyWithSign(200, 'income', 'EUR')
    const expense = formatMoneyWithSign(200, 'expense', 'EUR')
    expect(income.startsWith('+ ')).toBe(true)
    expect(expense.startsWith('- ')).toBe(true)
  })

  it('uses absolute value after the prefix', () => {
    const expense = formatMoneyWithSign(-200, 'expense', 'USD')
    expect(expense.startsWith('- ')).toBe(true)
    expect(expense.includes(getCurrency('USD').symbol)).toBe(true)
  })
})
