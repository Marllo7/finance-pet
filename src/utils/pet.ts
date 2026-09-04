import type { Transaction, Goal } from '../types/transaction'
import { toLocalDateStr } from '../types/date'

export interface PetStats {
  /** Текущий уровень (начиная с 1) */
  level: number
  /** Прогресс до следующего уровня, 0–100 */
  levelProgress: number
  /** XP всего: операции + цели */
  xp: number
  /** Сколько XP нужно на следующий уровень */
  xpToNextLevel: number
  /** Настроение 0–100 */
  moodPct: number
  /** Подпись настроения для отображения */
  moodLabel: string
  moodLabelEn: string
}

const XP_PER_LEVEL = 50

/**
 * Геймификация питомца:
 * - XP = 5 за каждую операцию + 20 за каждую цель + 2 за каждый процент накоплений по целям
 * - Уровень = floor(xp / 50) + 1
 * - Настроение зависит от финансовой активности за последние 7 дней:
 *   были операции и нет перерасхода — питомец доволен.
 */
export function calculatePetStats(
  transactions: Transaction[],
  goals: Pick<Goal, 'targetAmount' | 'savedAmount'>[]
): PetStats {
  const txXp = transactions.length * 5
  const goalXp = goals.length * 20
  const totalRatio = goals.reduce((s, g) => s + Math.min(1, g.targetAmount > 0 ? g.savedAmount / g.targetAmount : 0), 0)
  // Cap суммарного прогресса целей, чтобы фарм мелких целей был ограничен
  const savedRatio = Math.min(totalRatio, 3)
  const goalProgressXp = Math.round(savedRatio * 100) * 2
  const xp = txXp + goalXp + goalProgressXp

  const level = Math.floor(xp / XP_PER_LEVEL) + 1
  const xpInLevel = xp % XP_PER_LEVEL
  const levelProgress = Math.round((xpInLevel / XP_PER_LEVEL) * 100)
  const xpToNextLevel = XP_PER_LEVEL - xpInLevel

  // Настроение: активность за последние 7 календарных дней (включая сегодня)
  const weekAgoDate = new Date()
  weekAgoDate.setDate(weekAgoDate.getDate() - 6)
  const weekAgo = toLocalDateStr(weekAgoDate)
  const recent = transactions.filter((t) => t.date >= weekAgo)
  const recentIncome = recent.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const recentExpense = recent.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  let moodPct = 40 // базовое значение, если активности нет
  if (recent.length > 0) {
    moodPct = 60
    if (recent.length >= 3) moodPct += 15
    // Если расходы превышают доходы — настроение снижается
    if (recentExpense > recentIncome && recentIncome > 0) moodPct -= 20
    else if (recentIncome > 0) moodPct += 10
    // Мягкий штраф: есть только траты без доходов за 7 дней
    if (recentIncome === 0 && recentExpense > 0) moodPct -= 5
    moodPct = Math.min(100, Math.max(20, moodPct))
  }

  let moodLabel = 'грустит'
  let moodLabelEn = 'sad'
  if (moodPct >= 80) { moodLabel = 'доволен'; moodLabelEn = 'happy' }
  else if (moodPct >= 55) { moodLabel = 'спокоен'; moodLabelEn = 'calm' }

  return { level, levelProgress, xp, xpToNextLevel, moodPct, moodLabel, moodLabelEn }
}
