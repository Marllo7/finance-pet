import { describe, it, expect } from 'vitest'
import { getPeriodRange, filterTransactionsByPeriod, calculatePeriodBalance, toLocalDateStr } from '../../types/date'

describe('getPeriodRange', () => {
  it('should return same day for day period', () => {
    const result = getPeriodRange('day')
    expect(result).toBeDefined()
    expect(result!.start).toBe(result!.end)
    // Should be a valid date format
    expect(result!.start).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('should return week range (Monday to today), start is Monday locally', () => {
    const result = getPeriodRange('week')
    expect(result).toBeDefined()
    expect(result!.start).toBeDefined()
    expect(result!.end).toBeDefined()
    // Start should be Monday or earlier, end should be today
    const startDate = new Date(result!.start)
    const endDate = new Date(result!.end)
    expect(startDate <= endDate).toBe(true)
    // Start — именно понедельник в локальном времени (T12 чтобы не сдвигало таймзоной)
    expect(new Date(`${result!.start}T12:00:00`).getDay()).toBe(1)
    // End — сегодня локально
    expect(result!.end).toBe(toLocalDateStr(new Date()))
  })

  it('should return month range (1st to today)', () => {
    const result = getPeriodRange('month')
    expect(result).toBeDefined()
    const [year, month] = result!.start.split('-')
    // Month should be valid
    expect(parseInt(month)).toBeGreaterThan(0)
    expect(parseInt(month)).toBeLessThanOrEqual(12)
    expect(parseInt(year)).toBeGreaterThan(2020)
  })

  it('should return year range (Jan 1 to today)', () => {
    const result = getPeriodRange('year')
    expect(result).toBeDefined()
    const [year] = result!.start.split('-')
    // Year should be valid
    expect(parseInt(year)).toBeGreaterThan(2020)
  })

  it('should return null for all and custom periods', () => {
    expect(getPeriodRange('all')).toBeNull()
    expect(getPeriodRange('custom')).toBeNull()
  })
})

describe('filterTransactionsByPeriod', () => {
  const mockTransactions: Array<{ date: string }> = [
    { date: '2026-01-15' },
    { date: '2026-02-20' },
    { date: '2026-03-10' },
    { date: '2026-04-05' },
  ]

  it('should filter by day (today inside, yesterday outside)', () => {
    const today = toLocalDateStr(new Date())
    const y = new Date()
    y.setDate(y.getDate() - 1)
    const yesterday = toLocalDateStr(y)
    const txs = [{ date: today }, { date: yesterday }]
    const result = filterTransactionsByPeriod(txs, 'day', null)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe(today)
  })

  it('should filter by month (1st of month inside, previous month outside)', () => {
    const range = getPeriodRange('month')!
    const prev = new Date()
    prev.setDate(1)
    prev.setMonth(prev.getMonth() - 1)
    const prevStr = toLocalDateStr(prev)
    const txs = [{ date: range.start }, { date: prevStr }]
    const result = filterTransactionsByPeriod(txs, 'month', null)
    expect(result.map(t => t.date)).toContain(range.start)
    expect(result.map(t => t.date)).not.toContain(prevStr)
  })

  it('should filter by custom range', () => {
    const result = filterTransactionsByPeriod(mockTransactions, 'custom', {
      start: '2026-01-01',
      end: '2026-02-28',
    })
    expect(result).toHaveLength(2)
    expect(result[0].date).toBe('2026-01-15')
    expect(result[1].date).toBe('2026-02-20')
  })

  it('should return all transactions for "all" period', () => {
    const result = filterTransactionsByPeriod(mockTransactions, 'all', null)
    expect(result).toHaveLength(4)
  })
})

describe('calculatePeriodBalance', () => {
  const mockTransactions: Array<{ type: 'income' | 'expense'; amount: number; date: string }> = [
    { type: 'income', amount: 1000, date: '2026-01-15' },
    { type: 'expense', amount: 200, date: '2026-01-20' },
    { type: 'expense', amount: 300, date: '2026-02-10' },
    { type: 'income', amount: 500, date: '2026-03-05' },
  ]

  it('should calculate balance for custom range', () => {
    const result = calculatePeriodBalance(mockTransactions, 'custom', {
      start: '2026-01-01',
      end: '2026-01-31',
    })
    expect(result.income).toBe(1000)
    expect(result.expense).toBe(200)
    expect(result.balance).toBe(800)
  })

  it('should calculate balance for all transactions', () => {
    const result = calculatePeriodBalance(mockTransactions, 'all', null)
    expect(result.income).toBe(1500)
    expect(result.expense).toBe(500)
    expect(result.balance).toBe(1000)
  })

  it('should return zero for empty period', () => {
    const result = calculatePeriodBalance([], 'all', null)
    expect(result.income).toBe(0)
    expect(result.expense).toBe(0)
    expect(result.balance).toBe(0)
  })
})

describe('filterTransactionsByPeriod (real local-date checks)', () => {
  function localStr(offsetDays: number): string {
    const d = new Date()
    d.setDate(d.getDate() + offsetDays)
    return toLocalDateStr(d)
  }

  it('day: includes today, excludes yesterday', () => {
    const txs = [{ date: localStr(0) }, { date: localStr(-1) }]
    const result = filterTransactionsByPeriod(txs, 'day', null)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe(localStr(0))
  })

  it('week: includes a date inside current week, excludes 30 days ago', () => {
    const range = getPeriodRange('week')!
    const txs = [{ date: range.start }, { date: localStr(-30) }]
    const result = filterTransactionsByPeriod(txs, 'week', null)
    expect(result.map(t => t.date)).toContain(range.start)
    expect(result.map(t => t.date)).not.toContain(localStr(-30))
  })

  it('month: includes 1st of month, excludes previous month', () => {
    const range = getPeriodRange('month')!
    const prev = new Date()
    prev.setDate(1)
    prev.setMonth(prev.getMonth() - 1)
    const prevStr = toLocalDateStr(prev)
    const txs = [{ date: range.start }, { date: prevStr }]
    const result = filterTransactionsByPeriod(txs, 'month', null)
    expect(result.map(t => t.date)).toContain(range.start)
    expect(result.map(t => t.date)).not.toContain(prevStr)
  })

  it('custom with inverted range returns empty', () => {
    const txs = [{ date: '2026-01-15' }, { date: '2026-02-20' }]
    const result = filterTransactionsByPeriod(txs, 'custom', {
      start: '2026-03-01',
      end: '2026-01-01',
    })
    expect(result).toHaveLength(0)
  })
})
