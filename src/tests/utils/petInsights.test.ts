import { describe, it, expect } from 'vitest'
import { calcStreak, calcDailyStats, pickInsight, petRank } from '../../utils/petInsights'
import type { Transaction } from '../../types/transaction'

function tx(date: string, partial: Partial<Transaction> = {}): Transaction {
  return { id: date + Math.random(), type: 'expense', amount: 100, category: 'food', date, ...partial }
}

describe('petRank', () => {
  it('maps levels to titles ru/en', () => {
    expect(petRank(1, 'ru')).toBe('Малыш')
    expect(petRank(1, 'en')).toBe('Baby')
    expect(petRank(5, 'ru')).toBe('Хранитель')
    expect(petRank(9, 'ru')).toBe('Наставник')
    expect(petRank(20, 'en')).toBe('Magnate')
  })
})

describe('calcStreak', () => {
  it('returns 0 when empty', () => {
    expect(calcStreak([], new Date('2026-09-04T12:00:00'))).toBe(0)
  })
  it('counts consecutive days including today', () => {
    const now = new Date('2026-09-04T12:00:00')
    const list = [tx('2026-09-04'), tx('2026-09-03'), tx('2026-09-02')]
    expect(calcStreak(list, now)).toBe(3)
  })
  it('keeps streak alive when today is empty but yesterday has data', () => {
    const now = new Date('2026-09-04T12:00:00')
    const list = [tx('2026-09-03'), tx('2026-09-02')]
    expect(calcStreak(list, now)).toBe(2)
  })
  it('breaks on gap', () => {
    const now = new Date('2026-09-04T12:00:00')
    const list = [tx('2026-09-04'), tx('2026-09-02')]
    expect(calcStreak(list, now)).toBe(1)
  })
})

describe('calcDailyStats', () => {
  it('computes today/week and top category', () => {
    const now = new Date('2026-09-04T12:00:00')
    const list = [
      tx('2026-09-04', { amount: 200, category: 'food' }),
      tx('2026-09-03', { amount: 800, category: 'food' }),
      tx('2026-09-03', { amount: 200, category: 'fun', type: 'income' }),
    ]
    const s = calcDailyStats(list, [], now)
    expect(s.todayExpense).toBe(200)
    expect(s.weekExpense).toBe(1000)
    expect(s.weekIncome).toBe(200)
    expect(s.topCategory?.category).toBe('food')
    expect(s.topCategory!.share).toBeCloseTo(1)
  })
  it('safePerDay is null without income', () => {
    const now = new Date('2026-09-04T12:00:00')
    const s = calcDailyStats([tx('2026-09-04')], [], now)
    expect(s.safePerDay).toBeNull()
  })
  it('finds closest goal below 100%', () => {
    const now = new Date('2026-09-04T12:00:00')
    const s = calcDailyStats([], [{ name: 'Phone', targetAmount: 1000, savedAmount: 800 }], now)
    expect(s.closestGoal?.name).toBe('Phone')
    expect(s.closestGoal?.pct).toBe(80)
  })
})

describe('pickInsight', () => {
  function base() {
    return calcDailyStats([], [], new Date('2026-09-04T15:00:00'))
  }
  it('empty when no data', () => {
    expect(pickInsight(base(), 0, 0, 0, 15)).toBe('empty')
  })
  it('miss after 3 silent days', () => {
    const s = { ...base(), daysSilent: 4 }
    expect(pickInsight(s, 0, 5, 0, 15)).toBe('miss')
  })
  it('streak beats time-of-day', () => {
    const s = { ...base(), daysSilent: 0 }
    expect(pickInsight(s, 5, 10, 0, 9)).toBe('streak')
  })
  it('morning plan / evening summary fallback', () => {
    const s = { ...base(), daysSilent: 0 }
    expect(pickInsight(s, 1, 5, 0, 9)).toBe('plan')
    expect(pickInsight(s, 1, 5, 0, 20)).toBe('summary')
  })
})
