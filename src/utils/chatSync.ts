export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export const MAX_MESSAGES = 50

export function storageKeyFor(userId?: string | null): string {
  return userId ? `pet_chat_history_${userId}` : 'pet_chat_history_guest'
}

export function loadChatHistory(userId?: string | null): ChatMessage[] {
  try {
    const raw = localStorage.getItem(storageKeyFor(userId))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (m): m is ChatMessage =>
        typeof m === 'object' && m !== null &&
        ((m as any).role === 'user' || (m as any).role === 'assistant') &&
        typeof (m as any).content === 'string',
    )
  } catch { /* ignore */ }
  return []
}

export function saveChatHistory(messages: ChatMessage[], userId?: string | null): void {
  try {
    localStorage.setItem(storageKeyFor(userId), JSON.stringify(messages.slice(-MAX_MESSAGES)))
  } catch { /* ignore */ }
}

// Legacy: раньше приветствие сохранялось в БД первой строкой (часто устаревшее —
// без имени и с нулями). При чтении отрезаем его, чтобы не мозолило глаза.
export function stripLegacyGreeting(history: ChatMessage[]): ChatMessage[] {
  if (history.length === 0 || history[0].role !== 'assistant') return history
  const first = history[0].content
  const looksLikeGreeting =
    (first.startsWith('Привет!') || first.startsWith('Hi!')) &&
    (first.includes('питомец-помощник') || first.includes('pet assistant'))
  return looksLikeGreeting ? history.slice(1) : history
}

// Merge загруженной истории с сообщениями, отправленными пока шла загрузка
// (сравнение по role+content, чтобы не дублировать).
export function mergeWithHistory(history: ChatMessage[], current: ChatMessage[]): ChatMessage[] {
  if (current.length === 0) return history
  const keyOf = (m: ChatMessage) => `${m.role}\n${m.content}`
  const remaining = new Map<string, number>()
  for (const h of history) {
    const k = keyOf(h)
    remaining.set(k, (remaining.get(k) ?? 0) + 1)
  }
  const fresh: ChatMessage[] = []
  for (const m of current) {
    const k = keyOf(m)
    const c = remaining.get(k) ?? 0
    if (c > 0) remaining.set(k, c - 1)
    else fresh.push(m)
  }
  return [...history, ...fresh]
}

// Merge для Realtime-обновлений: remote — авторитетен для всего уже
// синхронизированного, поверх кладём только «грязные» (ещё не ушедшие в БД).
// Иначе удаление на устройстве A не смогло бы очистить устройство B.
export function mergeRemoteUpdate(
  lastSyncedJson: string | null,
  remote: ChatMessage[],
  current: ChatMessage[],
): ChatMessage[] {
  const keyOf = (m: ChatMessage) => `${m.role}\n${m.content}`
  let synced: ChatMessage[] | null = null
  try {
    const parsed = JSON.parse(lastSyncedJson ?? 'null') as ChatMessage[] | null
    if (Array.isArray(parsed)) synced = parsed
  } catch { /* ignore */ }
  const syncedCounts = new Map<string, number>()
  for (const m of synced ?? remote) {
    const k = keyOf(m)
    syncedCounts.set(k, (syncedCounts.get(k) ?? 0) + 1)
  }
  const remoteCounts = new Map<string, number>()
  for (const m of remote) {
    const k = keyOf(m)
    remoteCounts.set(k, (remoteCounts.get(k) ?? 0) + 1)
  }
  const dirty: ChatMessage[] = []
  for (const m of current) {
    const k = keyOf(m)
    const s = syncedCounts.get(k) ?? 0
    const r = remoteCounts.get(k) ?? 0
    if (s > 0) syncedCounts.set(k, s - 1)
    if (r > 0) remoteCounts.set(k, r - 1)
    if (s > 0 || r > 0) continue
    dirty.push(m)
  }
  return [...remote, ...dirty]
}

export function dragMovedEnough(
  startX: number,
  startY: number,
  clientX: number,
  clientY: number,
  threshold = 4,
): boolean {
  return Math.hypot(clientX - startX, clientY - startY) > threshold
}

export function computeDragPos(
  clientX: number,
  clientY: number,
  offsetX: number,
  offsetY: number,
  innerW: number,
  innerH: number,
): { bottom: number; right: number } {
  const newBottom = Math.max(16, innerH - clientY - offsetY)
  const newRight = Math.max(16, innerW - clientX - offsetX)
  return { bottom: Math.min(newBottom, innerH - 60), right: Math.min(newRight, innerW - 60) }
}
