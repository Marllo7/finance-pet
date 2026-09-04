import type { Goal, Transaction } from '../types/transaction'
import { toLocalDateStr } from '../types/date'
import type { Lang } from '../i18n'

/** Звание питомца по уровню — понятнее голого "Уровень 9". */
export function petRank(level: number, lang: Lang): string {
  const l = Math.max(1, Math.floor(level))
  if (l <= 2) return lang === 'ru' ? 'Малыш' : 'Baby'
  if (l <= 4) return lang === 'ru' ? 'Друг' : 'Buddy'
  if (l <= 7) return lang === 'ru' ? 'Хранитель' : 'Keeper'
  if (l <= 11) return lang === 'ru' ? 'Наставник' : 'Mentor'
  return lang === 'ru' ? 'Магнат' : 'Magnate'
}

function dayKey(d: Date): string {
  return toLocalDateStr(d)
}

function shiftDays(base: Date, delta: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + delta)
  return d
}

/**
 * Стрик: сколько дней подряд (включая сегодня или со вчерашнего дня,
 * если сегодня записей ещё нет) были операции.
 */
export function calcStreak(transactions: Transaction[], now = new Date()): number {
  if (transactions.length === 0) return 0
  const days = new Set(transactions.map((t) => t.date.slice(0, 10)))
  // Grace: если сегодня пусто — начинаем со вчера, серия ещё жива
  let cursor = dayKey(now)
  if (!days.has(cursor)) cursor = dayKey(shiftDays(now, -1))
  if (!days.has(cursor)) return 0
  let streak = 0
  let d = new Date(now)
  if (!days.has(dayKey(now))) d = shiftDays(now, -1)
  while (days.has(dayKey(d))) {
    streak++
    d = shiftDays(d, -1)
  }
  return streak
}

export interface DailyStats {
  todayIncome: number
  todayExpense: number
  weekIncome: number
  weekExpense: number
  /** Остаток месячного бюджета в день; null — не показываем (нет доходов). */
  safePerDay: number | null
  daysLeftInMonth: number
  topCategory: { category: string; amount: number; share: number } | null
  closestGoal: { name: string; pct: number; remaining: number } | null
  daysSilent: number
}

export function calcDailyStats(
  transactions: Transaction[],
  goals: Pick<Goal, 'name' | 'targetAmount' | 'savedAmount'>[],
  now = new Date(),
): DailyStats {
  const today = dayKey(now)
  const weekAgo = dayKey(shiftDays(now, -6))
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  let todayIncome = 0
  let todayExpense = 0
  let weekIncome = 0
  let weekExpense = 0
  let monthIncome = 0
  let monthExpense = 0
  const catSum = new Map<string, number>()
  let lastDate = ''

  for (const t of transactions) {
    const dk = t.date.slice(0, 10)
    if (dk > lastDate) lastDate = dk
    if (dk === today) {
      if (t.type === 'income') todayIncome += t.amount
      else todayExpense += t.amount
    }
    if (dk >= weekAgo) {
      if (t.type === 'income') weekIncome += t.amount
      else {
        weekExpense += t.amount
        catSum.set(t.category, (catSum.get(t.category) ?? 0) + t.amount)
      }
    }
    if (dk.slice(0, 7) === monthKey) {
      if (t.type === 'income') monthIncome += t.amount
      else monthExpense += t.amount
    }
  }

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeftInMonth = Math.max(1, daysInMonth - now.getDate() + 1)
  const safePerDay =
    monthIncome > 0 ? Math.max(0, (monthIncome - monthExpense) / daysLeftInMonth) : null

  let topCategory: DailyStats['topCategory'] = null
  if (weekExpense > 0) {
    let best = ''
    let bestSum = 0
    for (const [c, s] of catSum) {
      if (s > bestSum) {
        best = c
        bestSum = s
      }
    }
    if (best) topCategory = { category: best, amount: bestSum, share: bestSum / weekExpense }
  }

  let closestGoal: DailyStats['closestGoal'] = null
  for (const g of goals) {
    if (g.targetAmount <= 0) continue
    const pct = Math.round((g.savedAmount / g.targetAmount) * 100)
    if (pct >= 100) continue
    const remaining = Math.max(0, g.targetAmount - g.savedAmount)
    if (!closestGoal || pct > closestGoal.pct) closestGoal = { name: g.name, pct, remaining }
  }

  // Сколько дней тишины: от сегодня назад до последней записи
  let daysSilent = 0
  if (transactions.length > 0 && lastDate) {
    const ms = Date.parse(today) - Date.parse(lastDate)
    daysSilent = Math.max(0, Math.round(ms / 86_400_000))
    if (!Number.isFinite(daysSilent)) daysSilent = 0
  } else if (transactions.length === 0) {
    daysSilent = -1 // маркер "данных нет вообще"
  }

  return {
    todayIncome,
    todayExpense,
    weekIncome,
    weekExpense,
    safePerDay,
    daysLeftInMonth,
    topCategory,
    closestGoal,
    daysSilent,
  }
}

export type InsightKey =
  | 'empty'
  | 'miss'
  | 'topcat'
  | 'goal'
  | 'overspend'
  | 'streak'
  | 'plan'
  | 'summary'
  | 'calm'

/** Детерминированный выбор одного инсайта дня (приоритет + время суток). */
export function pickInsight(
  stats: DailyStats,
  streak: number,
  txCount: number,
  goalCount: number,
  hour = new Date().getHours(),
): InsightKey {
  if (txCount === 0 && goalCount === 0) return 'empty'
  if (stats.daysSilent >= 3) return 'miss'
  if (stats.topCategory && stats.topCategory.share >= 0.4 && stats.weekExpense > 0) return 'topcat'
  if (stats.closestGoal && stats.closestGoal.pct >= 75) return 'goal'
  if (stats.weekIncome > 0 && stats.weekExpense > stats.weekIncome) return 'overspend'
  if (streak >= 3) return 'streak'
  if (hour < 12) return 'plan'
  if (hour >= 18) return 'summary'
  return 'calm'
}

/** Человеческая фраза-причина настроения (почему доволен/грустит). */
export function moodReason(
  moodPct: number,
  stats: DailyStats,
  streak: number,
  lang: Lang,
): string {
  const ru = lang === 'ru'
  if (stats.daysSilent === -1) return ru ? 'Пока ничего не знает о тебе' : 'Does not know you yet'
  if (stats.daysSilent >= 3)
    return ru ? `Скучает — ${stats.daysSilent} дн. без записей` : `Miss you — ${stats.daysSilent}d silent`
  if (stats.weekIncome > 0 && stats.weekExpense > stats.weekIncome)
    return ru ? 'Ворчит — траты выше доходов' : 'Grumpy — spending above income'
  if (stats.closestGoal && stats.closestGoal.pct >= 75)
    return ru ? `Гордится — до «${stats.closestGoal.name}» чуть-чуть` : `Proud — «${stats.closestGoal.name}» almost done`
  if (streak >= 3) return ru ? `Доволен — серия ${streak} дн. подряд` : `Happy — ${streak}d streak`
  if (moodPct >= 80) return ru ? 'Сытый и довольный' : 'Full and happy'
  if (moodPct >= 55) return ru ? 'Спокоен, всё под контролем' : 'Calm, all under control'
  return ru ? 'Грустит — загляни в чат' : 'Sad — check the chat'
}
