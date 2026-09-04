import type { Transaction, Goal } from '../types/transaction'
import { parseAmount } from './parseAmount'
import { toLocalDateStr } from '../types/date'
import { formatMoney, type CurrencyCode } from './currencies'

export interface PetTransactionAction {
  action: 'create_transaction'
  type: 'income' | 'expense'
  amount: number | string
  category: string
  date: string
  comment?: string
}

export interface PetGoalAction {
  action: 'create_goal'
  name: string
  targetAmount: number
  icon?: string
  savedAmount?: number
  deadline?: string
}

/** Пополнить цель: клиент ищет цель по имени (регистронезависимо, подстрока). */
export interface PetAddToGoalAction {
  action: 'add_to_goal'
  name: string
  amount: number | string
}

/** Изменить цель: ищется по name, правится указанным. */
export interface PetUpdateGoalAction {
  action: 'update_goal'
  name: string
  newName?: string
  targetAmount?: number | string
  savedAmount?: number | string
}

/** Удалить цель по имени. */
export interface PetDeleteGoalAction {
  action: 'delete_goal'
  name: string
}

/**
 * Изменить операцию: клиент ищет ПОСЛЕДНЮЮ подходящую под search
 * (подстрока по комментарию/категории, либо точная сумма строкой/числом).
 */
export interface PetUpdateTransactionAction {
  action: 'update_transaction'
  search: string
  type?: 'income' | 'expense'
  amount?: number | string
  category?: string
  date?: string
  comment?: string
}

/** Удалить операцию: ищется последняя подходящая под search. */
export interface PetDeleteTransactionAction {
  action: 'delete_transaction'
  search: string
}

export type PetAction =
  | PetTransactionAction
  | PetGoalAction
  | PetAddToGoalAction
  | PetUpdateGoalAction
  | PetDeleteGoalAction
  | PetUpdateTransactionAction
  | PetDeleteTransactionAction

/**
 * Извлекает из ответа питомца JSON-действие ({"action":...}) в конце текста
 * и возвращает чистый текст без JSON.
 * Сканер сбалансированных фигурных скобок: учитывает строки в кавычках
 * и экранирование, находит ВСЕ {...}, среди них выбирает ПОСЛЕДНИЙ
 * валидный JSON с полем "action".
 */
export function extractAction(reply: string): { text: string; action?: PetAction } {
  const candidates: { start: number; end: number; raw: string }[] = []
  let depth = 0
  let start = -1
  let inString: string | null = null
  let escaped = false
  for (let i = 0; i < reply.length; i++) {
    const ch = reply[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === inString) {
        inString = null
      }
      continue
    }
    if (ch === '"') {
      inString = ch
    } else if (ch === '{') {
      if (depth === 0) start = i
      depth++
    } else if (ch === '}') {
      if (depth > 0) {
        depth--
        if (depth === 0 && start >= 0) {
          candidates.push({ start, end: i, raw: reply.slice(start, i + 1) })
          start = -1
        }
      }
    }
  }
  if (candidates.length === 0) return { text: reply.trim() }

  for (let k = candidates.length - 1; k >= 0; k--) {
    const { start: s, end: e, raw } = candidates[k]
    try {
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null || !('action' in parsed)) continue
      const text = (reply.slice(0, s) + reply.slice(e + 1)).trim()
      const normalized = normalizeActionAliases(parsed as Record<string, unknown>)
      // Неизвестный {"action":...} тоже вырезаем из показа, чтобы сырой JSON
      // никогда не утекал в чат (LLM иногда галлюцинирует форматы).
      if (!isPetAction(normalized)) return { text, action: undefined }
      return { text, action: normalized as PetAction }
    } catch {
      continue
    }
  }
  return { text: reply.trim() }
}

/**
 * Нормализация дрейфа формата LLM: модель иногда присылает search под
 * другим именем (query/text/name/description). Маппим на search ДО валидации,
 * иначе действие молча отбрасывается и "питомец перестал удалять".
 */
function normalizeActionAliases(parsed: Record<string, unknown>): Record<string, unknown> {
  const a = parsed.action
  if (a !== 'update_transaction' && a !== 'delete_transaction') return parsed
  if (typeof parsed.search === 'string' && parsed.search.trim().length > 0) return parsed
  const next = { ...parsed }
  for (const key of ['query', 'text', 'name', 'description']) {
    const v = next[key]
    if (typeof v === 'string' && v.trim().length > 0) {
      next.search = v
      break
    }
  }
  return next
}
function amountOk(v: unknown): boolean {
  if (typeof v === 'number') return v > 0 && Number.isFinite(v)
  if (typeof v === 'string') return parseAmount(v) !== null
  return false
}

export function toAmount(v: number | string): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null
  return parseAmount(v)
}

export function isPetAction(obj: unknown): obj is PetAction {
  if (typeof obj !== 'object' || obj === null) return false
  const a = obj as Record<string, unknown>
  if (a.action === 'create_transaction') {
    const amountOk = typeof a.amount === 'number'
      ? a.amount > 0 && Number.isFinite(a.amount)
      : typeof a.amount === 'string'
        ? parseAmount(a.amount) !== null
        : false
    const categoryOk = typeof a.category === 'string' && a.category.trim().length > 0
    const d = a.date
    const dateOk = d === undefined || d === null || d === '' || isValidCalendarDate(d)
    return (
      (a.type === 'income' || a.type === 'expense') &&
      amountOk &&
      categoryOk &&
      dateOk
    )
  }
  if (a.action === 'create_goal') {
    return (
      typeof a.name === 'string' && a.name.length > 0 &&
      typeof a.targetAmount === 'number' && a.targetAmount > 0
    )
  }
  if (a.action === 'add_to_goal') {
    return typeof a.name === 'string' && a.name.trim().length > 0 && amountOk(a.amount)
  }
  if (a.action === 'update_goal') {
    if (typeof a.name !== 'string' || a.name.trim().length === 0) return false
    const hasPatch = (typeof a.newName === 'string' && a.newName.trim().length > 0)
      || a.targetAmount !== undefined || a.savedAmount !== undefined
    if (!hasPatch) return false
    if (a.targetAmount !== undefined && !(typeof a.targetAmount === 'number' ? a.targetAmount > 0 && Number.isFinite(a.targetAmount) : amountOk(a.targetAmount))) return false
    if (a.savedAmount !== undefined && !(typeof a.savedAmount === 'number' ? a.savedAmount >= 0 && Number.isFinite(a.savedAmount) : parseAmount(a.savedAmount as string) !== null)) return false
    return true
  }
  if (a.action === 'delete_goal') {
    return typeof a.name === 'string' && a.name.trim().length > 0
  }
  if (a.action === 'update_transaction') {
    if (typeof a.search !== 'string' || a.search.trim().length === 0) return false
    if (a.type !== undefined && a.type !== 'income' && a.type !== 'expense') return false
    if (a.amount !== undefined && !amountOk(a.amount)) return false
    if (a.category !== undefined && !(typeof a.category === 'string' && a.category.trim().length > 0)) return false
    if (a.date !== undefined && a.date !== '' && !isValidCalendarDate(a.date)) return false
    const hasPatch = a.type !== undefined || a.amount !== undefined || a.category !== undefined
      || a.date !== undefined || (typeof a.comment === 'string' && a.comment.length > 0)
    return hasPatch
  }
  if (a.action === 'delete_transaction') {
    return typeof a.search === 'string' && a.search.trim().length > 0
  }
  return false
}

/** Проверяет, что строка — реальная календарная дата (месяц 1-12, день существует). */
export function isValidCalendarDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [ys, ms, ds] = s.split('-')
  const y = Number(ys)
  const m = Number(ms)
  const d = Number(ds)
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

/** Преобразует действие питомца в транзакцию (id генерируется, категория — label). */
export function actionToTransaction(a: PetTransactionAction): Transaction {
  const parsedAmount = typeof a.amount === 'string' ? parseAmount(a.amount) : a.amount
  return {
    id: `pet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: a.type,
    amount: typeof parsedAmount === 'number' && Number.isFinite(parsedAmount) ? parsedAmount : 0,
    category: a.category,
    date: isValidCalendarDate(a.date) ? a.date : toLocalDateStr(new Date()),
    comment: a.comment,
  }
}

/** Преобразует действие питомца в цель. */
export function actionToGoal(a: PetGoalAction): Omit<Goal, 'id' | 'createdAt'> {
  return {
    name: a.name,
    icon: a.icon ?? '🎯',
    targetAmount: a.targetAmount,
    savedAmount: typeof a.savedAmount === 'number' ? a.savedAmount : 0,
    deadline: isValidCalendarDate(a.deadline) ? (a.deadline as string) : undefined,
  }
}

/** Человекочитаемое описание действия для карточки подтверждения. */
export function describeAction(a: PetAction, lang: 'ru' | 'en', currency?: CurrencyCode): string {
  const cur: CurrencyCode = currency ?? 'EUR'
  if (a.action === 'create_transaction') {
    const typeLabel = a.type === 'income'
      ? (lang === 'ru' ? 'доход' : 'income')
      : (lang === 'ru' ? 'расход' : 'expense')
    const sum = formatMoney(Number(a.amount), cur)
    return lang === 'ru'
      ? `Добавить ${typeLabel}: ${sum} — ${a.category}`
      : `Add ${typeLabel}: ${sum} — ${a.category}`
  }
  if (a.action === 'create_goal') {
    const target = formatMoney(Number(a.targetAmount), cur)
    return lang === 'ru'
      ? `Создать цель «${a.name}» на ${target}`
      : `Create goal "${a.name}" for ${target}`
  }
  if (a.action === 'add_to_goal') {
    const sum = formatMoney(Number(toAmount(a.amount) ?? 0), cur)
    return lang === 'ru'
      ? `Пополнить цель «${a.name}» на ${sum}`
      : `Add ${sum} to goal "${a.name}"`
  }
  if (a.action === 'update_goal') {
    return lang === 'ru' ? `Изменить цель «${a.name}»` : `Update goal "${a.name}"`
  }
  if (a.action === 'delete_goal') {
    return lang === 'ru' ? `Удалить цель «${a.name}»` : `Delete goal "${a.name}"`
  }
  if (a.action === 'update_transaction') {
    return lang === 'ru' ? `Изменить операцию «${a.search}»` : `Update transaction "${a.search}"`
  }
  const target = (a as PetDeleteTransactionAction).search
  return lang === 'ru' ? `Удалить операцию «${target}»` : `Delete transaction "${target}"`
}

// --- Поиск записей для update/delete (чистые функции, покрыты тестами) ---

function norm(s: string): string {
  return s.trim().toLowerCase()
}

/** Цель по имени: точное совпадение приоритетнее подстроки. */
export function findGoalByName<T extends { name: string }>(goals: T[], name: string): T | null {
  const n = norm(name)
  if (!n) return null
  const exact = goals.find((g) => norm(g.name) === n)
  if (exact) return exact
  const found = goals.filter((g) => norm(g.name).includes(n) || n.includes(norm(g.name)))
  return found.length > 0 ? found[0] : null
}

/**
 * Операция по описанию: ищет ПОСЛЕДНЮЮ (самую свежую) подходящую.
 * search матчится как подстрока комментария/категории либо как точная сумма.
 */
export function findTransactionBySearch<T extends { comment?: string; category: string; amount: number }>(
  txs: T[],
  search: string,
): T | null {
  const n = norm(search)
  if (!n) return null
  const asAmount = parseAmount(search)
  for (let i = txs.length - 1; i >= 0; i--) {
    const tx = txs[i]
    if (asAmount !== null && tx.amount === asAmount) return tx
    const comment = norm(tx.comment ?? '')
    const cat = norm(tx.category)
    if ((comment && (comment.includes(n) || n.includes(comment))) || cat.includes(n) || n.includes(cat)) return tx
  }
  return null
}
