import { describe, it, expect } from 'vitest'
import { calculatePetStats } from '../../utils/pet'
import type { Transaction } from '../../types/transaction'

function tx(partial: Partial<Transaction> = {}): Transaction {
  return {
    id: '1',
    type: 'expense',
    amount: 100,
    category: 'other',
    date: '2026-09-01',
    ...partial,
  }
}

describe('calculatePetStats level/XP math', () => {
  it('starts at level 1 with zero xp when empty', () => {
    const s = calculatePetStats([], [])
    expect(s.xp).toBe(0)
    expect(s.level).toBe(1)
    expect(s.levelProgress).toBe(0)
    expect(s.xpToNextLevel).toBe(50)
  })

  it('gives 5 XP per transaction and 20 XP per goal', () => {
    const s = calculatePetStats([tx(), tx()], [{ targetAmount: 100, savedAmount: 0 }])
    // 2*5 + 1*20 + 0 progress = 30
    expect(s.xp).toBe(30)
    expect(s.level).toBe(1)
    expect(s.levelProgress).toBe(60)
    expect(s.xpToNextLevel).toBe(20)
  })

  it('levels up every 50 XP', () => {
    const many = Array.from({ length: 10 }, (_, i) => tx({ id: String(i) }))
    const s = calculatePetStats(many, [])
    expect(s.xp).toBe(50)
    expect(s.level).toBe(2)
    expect(s.levelProgress).toBe(0)
    expect(s.xpToNextLevel).toBe(50)
  })

  it('caps goal progress ratio at 3 (600 progress XP max)', () => {
    const goals = Array.from({ length: 10 }, () => ({ targetAmount: 100, savedAmount: 100 }))
    const s = calculatePetStats([], goals)
    // 10*20 + min(10,3)*100*2 = 200 + 600 = 800
    expect(s.xp).toBe(800)
    expect(s.level).toBe(Math.floor(800 / 50) + 1)
  })

  it('counts partial goal progress proportionally', () => {
    const s = calculatePetStats([], [{ targetAmount: 200, savedAmount: 100 }])
    // 20 + round(0.5*100)*2 = 20 + 100 = 120
    expect(s.xp).toBe(120)
  })

  it('ignores goals with non-positive target in progress', () => {
    const s = calculatePetStats([], [{ targetAmount: 0, savedAmount: 100 }])
    expect(s.xp).toBe(20)
  })
})
