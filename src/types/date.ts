export type PeriodOption = 'day' | 'week' | 'month' | 'year' | 'all' | 'custom'

export interface DateRange {
  start: string // YYYY-MM-DD
  end: string   // YYYY-MM-DD
}

/**
 * Форматирует дату в YYYY-MM-DD, используя ЛОКАЛЬНОЕ время пользователя.
 *toISOString() ломается на таймзонах: 01.09 00:00 MSK → 31.08 21:00 UTC.
 */
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/**
 * Вычисляет начало и конец периода в виде YYYY-MM-DD строк.
 */
export function getPeriodRange(period: PeriodOption): DateRange | null {
  const now = new Date()
  
  switch (period) {
    case 'day': {
      return {
        start: toLocalDateStr(now),
        end: toLocalDateStr(now),
      }
    }
    
    case 'week': {
      const start = new Date(now)
      const dayOfWeek = start.getDay()
      const diff = start.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // понедельник
      start.setDate(diff)
      start.setHours(0, 0, 0, 0)
      return {
        start: toLocalDateStr(start),
        end: toLocalDateStr(now),
      }
    }
    
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return {
        start: toLocalDateStr(start),
        end: toLocalDateStr(now),
      }
    }
    
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1)
      return {
        start: toLocalDateStr(start),
        end: toLocalDateStr(now),
      }
    }
    
    case 'all':
    case 'custom':
      return null
    
    default:
      return null
  }
}

/**
 * Фильтрует транзакции по периоду.
 */
export function filterTransactionsByPeriod<T extends { date: string }>(
  transactions: T[],
  period: PeriodOption,
  customRange: DateRange | null
): T[] {
  if (customRange && period === 'custom') {
    return transactions.filter(t => t.date >= customRange.start && t.date <= customRange.end)
  }
  
  const range = getPeriodRange(period)
  if (!range) {
    // 'all' — все транзакции
    return transactions
  }
  
  return transactions.filter(t => t.date >= range.start && t.date <= range.end)
}

/**
 * Вычисляет баланс по периоду.
 */
export function calculatePeriodBalance(
  transactions: Array<{ type: 'income' | 'expense'; amount: number; date: string }>,
  period: PeriodOption,
  customRange: DateRange | null
): { income: number; expense: number; balance: number } {
  const filtered = filterTransactionsByPeriod(transactions as any, period, customRange)
  
  let income = 0
  let expense = 0
  
  for (const t of filtered) {
    const tx = t as { type: 'income' | 'expense'; amount: number; date: string }
    if (tx.type === 'income') {
      income += tx.amount
    } else {
      expense += tx.amount
    }
  }
  
  return { income, expense, balance: income - expense }
}
