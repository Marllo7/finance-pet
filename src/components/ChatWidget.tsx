import { useState, useEffect, useRef, useCallback } from 'react'
import { Cat, Send, Trash2, Timer, Mic, ChevronsDown, Paperclip, FileText, X, Image as ImageIcon } from 'lucide-react'
import { useSettings } from '../contexts/SettingsContext'
import { useAuth } from '../contexts/AuthContext'
import { extractAction, actionToTransaction, actionToGoal, toAmount, findGoalByName, findTransactionBySearch } from '../utils/chatActions'
import { findCategory } from '../utils/categories'
import { capitalize } from '../utils/capitalize'
import { formatMoney } from '../utils/currencies'
import { toLocalDateStr } from '../types/date'
import { t } from '../i18n'
import { ConfirmModal } from './ConfirmModal'
import { OPEN_CHAT_EVENT, useTourDemo } from '../utils/tourDemo'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Transaction, Goal, Category } from '../types/transaction'
import {
  MAX_MESSAGES,
  computeDragPos,
  dragMovedEnough,
  loadChatHistory,
  mergeRemoteUpdate,
  mergeWithHistory,
  saveChatHistory,
  storageKeyFor,
  stripLegacyGreeting,
  type ChatMessage,
} from '../utils/chatSync'
import {
  attachmentHistoryBlock,
  parseDisplay,
  prepareAttachments,
  validateFiles,
  type PendingAttachment,
} from '../utils/attachments'

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
const voiceSupported = !!SpeechRecognition

// Сохранённые координаты виджета
function loadWidgetPos(): { bottom: number; right: number } {
  try {
    const raw = localStorage.getItem('chat_widget_pos')
    if (raw) {
      const p = JSON.parse(raw)
      if (typeof p.bottom === 'number' && typeof p.right === 'number'
        && Number.isFinite(p.bottom) && Number.isFinite(p.right)) return p
    }
  } catch { /* ignore */ }
  return { bottom: 16, right: 16 } // bottom-4 right-4
}

interface Props {
  transactions: Transaction[]
  goals: Goal[]
  categories?: Category[]
  userName?: string | null
  petName?: string | null
  userId?: string | null
  onAddTransaction?: (t: Transaction) => Promise<{ error: string | null }>
  onAddGoal?: (g: Omit<Goal, 'id' | 'createdAt'>) => Promise<{ error: string | null }>
  onUpdateTransaction?: (id: string, patch: Partial<Transaction>, categoryId: string | null) => Promise<{ error: string | null }>
  onDeleteTransaction?: (id: string) => Promise<{ error: string | null }>
  onUpdateGoal?: (id: string, patch: Partial<Pick<Goal, 'name' | 'icon' | 'targetAmount' | 'savedAmount' | 'deadline' | 'color'>>) => Promise<{ error: string | null }>
  onDeleteGoal?: (id: string) => Promise<{ error: string | null }>
}

export function ChatWidget({ transactions, goals, categories, userName, petName, userId, onAddTransaction, onAddGoal, onUpdateTransaction, onDeleteTransaction, onUpdateGoal, onDeleteGoal }: Props) {
  const { lang, currency } = useSettings()
  const { user, session } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isMobileView, setIsMobileView] = useState(typeof window !== 'undefined' && window.innerWidth < 640)
  // Вложения к следующему сообщению + превью отправленных фото (локально, не в БД)
  const [pendingAtt, setPendingAtt] = useState<PendingAttachment[]>([])
  const [attaching, setAttaching] = useState(false)
  const [previews, setPreviews] = useState<Record<string, string[]>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Позиция: bottom от низа экрана, right от правого края
  const [pos, setPos] = useState(loadWidgetPos)
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  // Точка старта драга: позиция обновляется только после сдвига > порога,
  // иначе обычный клик с джиттером руки «слегка отбрасывал» окно/иконку в сторону
  const dragStartRef = useRef({ x: 0, y: 0 })
  const listRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)
  const prevExpandedRef = useRef(false)
  // Единый user id: пропс (из App) и сессия должны совпадать; приоритет — сессии
  const effectiveUserId = user?.id ?? userId ?? null
  // Снапшот последнего загруженного/с-охранённого состояния — чтобы не гнать echo delete+insert по кругу
  const lastSyncedRef = useRef<string | null>(null)
  // Загрузка ещё не завершена — сохранения запрещены (иначе пустой state затрёт кэш и БД на монтировании)
  const hasLoadedRef = useRef(false)
  // Ожидающий debounce-записи батч — для flush при размонтировании
  const pendingRef = useRef<{ msgs: ChatMessage[]; uid: string } | null>(null)
  // Очередь записей в БД: чейним промисы, чтобы параллельные persist не затирали друг друга
  const saveChainRef = useRef<Promise<void>>(Promise.resolve())
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recognitionRef = useRef<any>(null)
  // Актуальный interim-текст вне замыканий onend/onerror
  const interimRef = useRef('')
  // Актуальный loading вне замыкания recognition.onresult
  const loadingRef = useRef(false)
  const handleSendRef = useRef<(text: string) => void>(() => {})
  const sentTextRef = useRef<Set<string>>(new Set())

  useEffect(() => { handleSendRef.current = handleSend })

  // Тур может попросить раскрыть чат и отправить демо-текст (авто-показ)
  useEffect(() => {
    function onOpen() {
      setIsExpanded(true)
    }
    window.addEventListener(OPEN_CHAT_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_CHAT_EVENT, onOpen)
  }, [])
  useTourDemo((text) => {
    setIsExpanded(true)
    handleSendRef.current(text)
  })

  useEffect(() => { loadingRef.current = loading }, [loading])

  // Cleanup распознавания при размонтировании
  useEffect(() => () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort?.() } catch { /* ignore */ }
      try { recognitionRef.current.stop?.() } catch { /* ignore */ }
      recognitionRef.current = null
    }
  }, [])

  // Track mobile viewport
  useEffect(() => {
    function onResize() {
      setIsMobileView(window.innerWidth < 640)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Save position
  useEffect(() => {
    try {
      localStorage.setItem('chat_widget_pos', JSON.stringify(pos))
    } catch { /* ignore (private mode / quota) */ }
  }, [pos])

  // Persist: сначала атомарный RPC save_chat_messages, при отсутствии
  // функции в БД (42883/PGRST202) — fallback на старый delete→insert.
  // created_at руками не выставляем — его ставит RPC (ordinality).
  // ВАЖНО: пустой массив = явная очистка чата. Через merge-RPC его гнать
  // нельзя: RPC конвергентный (merged = existing + недостающее из incoming),
  // пустой incoming вернёт старые сообщения обратно. Поэтому пусто → прямой DELETE.
  async function persistToSupabase(msgs: ChatMessage[], uid: string) {
    const toSave = msgs.slice(-MAX_MESSAGES).map(m => ({
      role: m.role,
      content: m.content,
    }))
    if (toSave.length === 0) {
      try {
        const { error: delError } = await supabase.from('chat_messages').delete().eq('user_id', uid)
        if (delError) console.warn('chat clear delete failed:', delError.message)
      } catch (e) {
        console.warn('chat clear failed:', e)
      }
      return
    }
    try {
      const { error: rpcError } = await (supabase as any).rpc('save_chat_messages', { msgs: toSave })
      if (!rpcError) return
      const code = (rpcError as any)?.code
      const msg = String((rpcError as any)?.message ?? '')
      const missing = code === '42883' || code === 'PGRST202' || msg.includes('42883') || msg.includes('PGRST202')
      if (!missing) {
        console.warn('chat sync rpc failed:', msg || rpcError)
        return
      }
      // Fallback для БД без RPC
      void uid
    } catch (e) {
      const msg = String((e as any)?.message ?? e ?? '')
      const code = (e as any)?.code
      const missing = code === '42883' || code === 'PGRST202' || msg.includes('42883') || msg.includes('PGRST202')
      if (!missing) {
        console.warn('chat sync rpc failed:', e)
        return
      }
    }
    try {
      const { error: delError } = await supabase.from('chat_messages').delete().eq('user_id', uid)
      if (delError) {
        console.warn('chat sync delete failed:', delError.message)
        return
      }
      const toSaveLegacy = msgs.slice(-MAX_MESSAGES).map(m => ({
        user_id: uid,
        role: m.role,
        content: m.content,
      }))
      if (toSaveLegacy.length > 0) {
        const { error: insError } = await supabase.from('chat_messages').insert(toSaveLegacy)
        if (insError) console.warn('chat sync insert failed:', insError.message)
      }
    } catch (e) {
      console.warn('chat sync failed:', e)
    }
  }

  function queuePersist(msgs: ChatMessage[], uid: string) {
    saveChainRef.current = saveChainRef.current
      .then(() => persistToSupabase(msgs, uid))
      .then(() => {
        lastSyncedRef.current = JSON.stringify(msgs)
      })
  }

  // Единая загрузка истории из БД (select + чистка + освежение кэша).
  // Используется и при монтировании, и при Realtime-обновлениях.
  // ok=false — только при ошибке запроса (тогда history = кэш).
  // ok=true + пусто — remote достоверно пуст (чат очищен): кэш НЕ воскрешаем.
  async function loadRemoteHistory(uid: string): Promise<{ history: ChatMessage[]; ok: boolean }> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('user_id', uid)
      .order('created_at', { ascending: true })
      .limit(MAX_MESSAGES)
    if (error) {
      console.warn('chat load failed, using local cache:', error.message)
      return { history: stripLegacyGreeting(loadChatHistory(uid)), ok: false }
    }
    if (!data || data.length === 0) return { history: [], ok: true }
    const history = stripLegacyGreeting(
      data.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    )
    // Освежаем localStorage кэш, чтобы offline fallback был актуальным
    saveChatHistory(history, uid)
    return { history, ok: true }
  }

  // Load history from Supabase (if logged in) or localStorage.
  // В state хранится ТОЛЬКО реальная переписка; приветствие дорисовывается при рендере.
  useEffect(() => {
    hasLoadedRef.current = false
    lastSyncedRef.current = null
    setMessages([])
    if (!user?.id) {
      // Guest: load from localStorage
      const history = stripLegacyGreeting(loadChatHistory(effectiveUserId))
      lastSyncedRef.current = JSON.stringify(history)
      hasLoadedRef.current = true
      // Пока грузилась история пользователь мог уже отправить сообщения —
      // не затираем state, а мержим: history + свежие элементы state
      setMessages(current => mergeWithHistory(history, current))
      return
    }
    // Logged in: load from Supabase, при проблеме — fallback на localStorage кэш
    let cancelled = false
    ;(async () => {
      const { history, ok } = await loadRemoteHistory(user.id)
      if (cancelled) return
      // Remote достоверно пуст (ok) — чат был очищен: гасим и кэш, НЕ воскрешаем стёртое.
      // ok=false — ошибка запроса, history уже равен кэшу из loadRemoteHistory.
      if (ok && history.length === 0) saveChatHistory([], user.id)
      lastSyncedRef.current = JSON.stringify(history)
      hasLoadedRef.current = true
      // Пока грузилась история пользователь мог уже отправить сообщения —
      // не затираем state, а мержим: history + свежие элементы state
      setMessages(current => mergeWithHistory(history, current))
    })()
    return () => { cancelled = true }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live-sync между устройствами: изменения из БД подтягиваются без reload
  // (свои записи тоже прилетают обратно — merge отбрасывает их как дубликаты,
  // а «грязные» неотправленные бережно сохраняются поверх).
  // Требует: alter publication supabase_realtime add table public.chat_messages
  useEffect(() => {
    if (!user?.id) return
    const uid = user.id
    const channel = supabase
      .channel(`chat_${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `user_id=eq.${uid}` }, () => {
        if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
        refetchTimerRef.current = setTimeout(() => {
          refetchTimerRef.current = null
          void (async () => {
            const { history, ok } = await loadRemoteHistory(uid)
            // Удаление на другом устройстве: remote достоверно пуст — гасим и кэш
            if (ok && history.length === 0) saveChatHistory([], uid)
            // ВАЖНО: prevSynced берём ДО перезаписи, иначе merge сочтёт весь
            // текущий state «грязным» и удаление на A не очистит B
            const prevSynced = lastSyncedRef.current
            lastSyncedRef.current = JSON.stringify(history)
            setMessages(current => mergeRemoteUpdate(prevSynced, history, current))
          })()
        }, 800)
      })
      .subscribe()
    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
      void supabase.removeChannel(channel)
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save to both Supabase and localStorage on change (debounced, без echo после загрузки)
  useEffect(() => {
    // Пока загрузка не завершена — ничего не трогаем, иначе пустой initial state
    // затрёт localStorage-кэш, а в БД уйдёт persist([]) и снесёт историю
    if (!hasLoadedRef.current) return
    // Всегда обновляем локальный кэш сразу (даже пустой — чтобы очистка переживала reload)
    saveChatHistory(messages, effectiveUserId)
    if (!user?.id) return
    // Пропускаем save, если состояние совпадает с только что загруженным
    const key = JSON.stringify(messages)
    if (key === lastSyncedRef.current) return
    // Debounce: сообщение пользователя + ответ ассистента уходят одним батчем
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    const snapshot = messages
    const uid = user.id
    pendingRef.current = { msgs: snapshot, uid }
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      pendingRef.current = null
      queuePersist(snapshot, uid)
    }, 500)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [messages, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Flush ожидающей записи при размонтировании (иначе последний батч теряется,
  // т.к. cleanup выше отменяет debounce-таймер)
  useEffect(() => () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (refetchTimerRef.current) {
      clearTimeout(refetchTimerRef.current)
      refetchTimerRef.current = null
    }
    const pending = pendingRef.current
    pendingRef.current = null
    if (pending && pending.msgs.length > 0) queuePersist(pending.msgs, pending.uid)
  }, [])

  // Scroll: при открытии и подгрузке истории — мгновенно в конец,
  // при новых сообщениях в открытом чате — плавно. Скроллим сам контейнер,
  // чтобы не дёргать страницу позади (scrollIntoView скроллит всех предков).
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    if (!isExpanded) {
      prevCountRef.current = messages.length
      prevExpandedRef.current = false
      return
    }
    const justOpened = !prevExpandedRef.current
    const grew = messages.length > prevCountRef.current
    prevExpandedRef.current = true
    prevCountRef.current = messages.length
    list.scrollTo({
      top: list.scrollHeight,
      behavior: justOpened || !grew ? 'auto' : 'smooth',
    })
  }, [messages, loading, isExpanded])

  function buildWelcomeMessage(): string {
    const today = toLocalDateStr(new Date())
    const now = new Date()
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const monthExpense = transactions
      .filter((t) => t.type === 'expense' && t.date.slice(0, 7) === thisMonthKey)
      .reduce((s, t) => s + t.amount, 0)
    const totalSaved = goals.reduce((s, g) => s + g.savedAmount, 0)
    const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0)
    const nameGreeting = userName ? `${capitalize(userName)}. ` : ''
    return `${lang === 'ru' ? 'Привет' : 'Hi'}! ${nameGreeting}${lang === 'ru' ? 'Я твой питомец-помощник.' : 'I am your pet assistant.'}\n\n` +
      `${lang === 'ru' ? 'Сегодня' : 'Today'}: ${today}\n\n` +
      `${lang === 'ru' ? 'Вот что я знаю' : 'Here is what I know'}:\n` +
      `• ${lang === 'ru' ? 'Расходы за месяц' : 'Month expenses'}: ${formatMoney(monthExpense, currency)}\n` +
      `• ${lang === 'ru' ? 'Накоплено по целям' : 'Saved toward goals'}: ${formatMoney(totalSaved, currency)} / ${formatMoney(totalTarget, currency)}\n\n` +
      `${lang === 'ru' ? 'Я могу' : 'I can'}:\n` +
      `• ${lang === 'ru' ? 'Советовать по бюджету' : 'Give budget advice'}\n` +
      `• ${lang === 'ru' ? 'Показывать статистику' : 'Show statistics'}\n` +
      `• ${lang === 'ru' ? 'Создавать записи и цели — например, напиши «купил кофе за 200»' : 'Create records and goals — e.g. type "coffee for 5"'}\n\n` +
      `${lang === 'ru' ? 'Просто напиши — я помогу!' : 'Just type — I will help!'}`
  }

  function handleSend(text: string) {
    const trimmed = text.trim()
    const atts = pendingAtt
    if ((!trimmed && atts.length === 0) || loading) return
    setPendingAtt([])

    let full = trimmed || (lang === 'ru' ? 'Разбери вложения' : 'Review the attachments')
    if (atts.length > 0) {
      full += '\n' + atts.map(attachmentHistoryBlock).join('\n')
      const imgs = atts.filter((a) => a.kind === 'image').map((a) => a.payload)
      if (imgs.length > 0) setPreviews((prev) => ({ ...prev, [full]: imgs }))
    }
    const userMessage: ChatMessage = { role: 'user', content: full }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setInterimText('')
    setLoading(true)
    setError('')
    saveChatHistory(newMessages, effectiveUserId)

    if (!isSupabaseConfigured) {
      setTimeout(() => {
        const fallback: ChatMessage = {
          role: 'assistant',
          content: lang === 'ru'
            ? '❌ Supabase не настроен. Задайте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в переменных окружения.'
            : '❌ Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY env variables.',
        }
        const updated = [...newMessages, fallback]
        setMessages(updated)
        saveChatHistory(updated, effectiveUserId)
        setLoading(false)
        sentTextRef.current.delete(trimmed)
      }, 400)
      return
    }

    void sendToApi(newMessages, atts).finally(() => {
      sentTextRef.current.delete(trimmed)
    })
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || attaching) return
    const list = Array.from(files)
    if (fileInputRef.current) fileInputRef.current.value = ''
    const v = validateFiles(list)
    if (!v.ok) {
      setError(lang === 'ru' ? v.errorRu : v.errorEn)
      setTimeout(() => setError(''), 3500)
      return
    }
    setAttaching(true)
    try {
      const prepared = await prepareAttachments(list)
      setPendingAtt((prev) => [...prev, ...prepared].slice(0, 3))
    } catch {
      setError(lang === 'ru' ? 'Не получилось прочитать файл' : 'Could not read the file')
      setTimeout(() => setError(''), 3500)
    } finally {
      setAttaching(false)
    }
  }

  async function sendToApi(baseMessages: ChatMessage[], atts: PendingAttachment[]) {
    try {
      // Имена передаём отдельными полями: edge сам вплетёт их в свой системный промпт.
      // (свой role:'system' слать нельзя — сервер отбрасывает клиентские system-сообщения)
      const conversation = baseMessages.map((m) => ({ role: m.role, content: m.content }))
      // Снапшот данных, чтобы LLM видел цели/операции и мог пополнять,
      // изменять и удалять их по названию/описанию (иначе он выдумывает JSON).
      const goalsSnapshot = goals.slice(0, 30).map((g) => ({
        name: g.name,
        savedAmount: g.savedAmount,
        targetAmount: g.targetAmount,
      }))
      const recentTransactions = transactions.slice(0, 15).map((x) => ({
        type: x.type,
        amount: x.amount,
        category: x.category,
        date: x.date,
        comment: x.comment ?? '',
      }))

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ messages: conversation, lang, userName: userName ?? null, petName: petName ?? null, tzOffsetMinutes: new Date().getTimezoneOffset(), goals: goalsSnapshot, recentTransactions, attachments: atts.map((a) => (a.kind === 'image' ? { kind: 'image', dataUrl: a.payload } : { kind: 'text', name: a.name, text: a.payload })) }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const rawReply: string = data.reply || (lang === 'ru' ? 'Не нашёл, что ответить.' : 'I have nothing to add.')

      const { text, action } = extractAction(rawReply)
      // LLM иногда возвращает только JSON без текста — пустой бабл не показываем
      const displayText = text.trim() === '' ? (lang === 'ru' ? 'Готово!' : 'Done!') : text
      let assistantMessage: ChatMessage = { role: 'assistant', content: displayText }

      if (action) {
        const okMsg = lang === 'ru' ? 'Готово!' : 'Done!'
        const failMsg = (e: string | null) => (lang === 'ru' ? `Не получилось: ${e}` : `Failed: ${e}`);
        if (action.action === 'create_transaction' && onAddTransaction) {
          const t = actionToTransaction(action)
          const result = await onAddTransaction(t)
          assistantMessage = { role: 'assistant', content: `${displayText}\n\n${result.error ? '⚠️ ' + result.error : '✅ ' + (lang === 'ru' ? 'Добавлено!' : 'Added!')}` }
        } else if (action.action === 'create_goal' && onAddGoal) {
          const g = actionToGoal(action)
          const result = await onAddGoal(g)
          assistantMessage = { role: 'assistant', content: `${displayText}\n\n${result.error ? '⚠️ ' + result.error : '✅ ' + (lang === 'ru' ? 'Создано!' : 'Created!')}` }
        } else if (action.action === 'add_to_goal' && onUpdateGoal) {
          const goal = findGoalByName(goals, action.name)
          if (!goal) {
            const names = goals.map((g) => `«${g.name}»`).join(', ')
            assistantMessage = { role: 'assistant', content: `${displayText}\n\n⚠️ ${lang === 'ru' ? `Не нашёл цель «${action.name}»` : `Goal "${action.name}" not found`}${names ? (lang === 'ru' ? `. У тебя есть: ${names}` : `. Your goals: ${names}`) : ''}` }
          } else {
            const add = toAmount(action.amount) ?? 0
            const result = await onUpdateGoal(goal.id, { savedAmount: goal.savedAmount + add })
            assistantMessage = { role: 'assistant', content: `${displayText}\n\n${result.error ? '⚠️ ' + failMsg(result.error) : '✅ ' + (lang === 'ru' ? `Пополнено! Теперь в цели «${goal.name}» ${formatMoney(goal.savedAmount + add, currency)}.` : `${okMsg}`)}` }
          }
        } else if (action.action === 'update_goal' && onUpdateGoal) {
          const goal = findGoalByName(goals, action.name)
          if (!goal) {
            assistantMessage = { role: 'assistant', content: `${displayText}\n\n⚠️ ${lang === 'ru' ? `Не нашёл цель «${action.name}»` : `Goal "${action.name}" not found`}` }
          } else {
            const patch: Partial<Pick<Goal, 'name' | 'targetAmount' | 'savedAmount'>> = {}
            if (action.newName?.trim()) patch.name = action.newName.trim()
            if (action.targetAmount !== undefined) { const v = toAmount(action.targetAmount); if (v !== null) patch.targetAmount = v }
            if (action.savedAmount !== undefined) {
              patch.savedAmount = typeof action.savedAmount === 'number'
                ? action.savedAmount
                : (toAmount(action.savedAmount) ?? goal.savedAmount)
            }
            const result = await onUpdateGoal(goal.id, patch)
            assistantMessage = { role: 'assistant', content: `${displayText}\n\n${result.error ? '⚠️ ' + failMsg(result.error) : '✅ ' + okMsg}` }
          }
        } else if (action.action === 'delete_goal' && onDeleteGoal) {
          const goal = findGoalByName(goals, action.name)
          if (!goal) {
            assistantMessage = { role: 'assistant', content: `${displayText}\n\n⚠️ ${lang === 'ru' ? `Не нашёл цель «${action.name}»` : `Goal "${action.name}" not found`}` }
          } else {
            const result = await onDeleteGoal(goal.id)
            assistantMessage = { role: 'assistant', content: `${displayText}\n\n${result.error ? '⚠️ ' + failMsg(result.error) : '✅ ' + (lang === 'ru' ? `Цель «${goal.name}» удалена.` : `Goal "${goal.name}" deleted.`)}` }
          }
        } else if (action.action === 'update_transaction' && onUpdateTransaction) {
          const tx = findTransactionBySearch(transactions, action.search)
          if (!tx) {
            assistantMessage = { role: 'assistant', content: `${displayText}\n\n⚠️ ${lang === 'ru' ? `Не нашёл операцию «${action.search}»` : `Transaction "${action.search}" not found`}` }
          } else {
            const patch: Partial<Transaction> = {}
            if (action.type) patch.type = action.type
            if (action.amount !== undefined) { const v = toAmount(action.amount); if (v !== null) patch.amount = v }
            if (action.category) patch.category = action.category
            if (action.date) patch.date = action.date
            if (action.comment) patch.comment = action.comment
            const cat = patch.category ? findCategory(categories ?? [], patch.category) : undefined
            const result = await onUpdateTransaction(tx.id, patch, cat?.id ?? null)
            assistantMessage = { role: 'assistant', content: `${displayText}\n\n${result.error ? '⚠️ ' + failMsg(result.error) : '✅ ' + (lang === 'ru' ? 'Операция обновлена!' : 'Transaction updated!')}` }
          }
        } else if (action.action === 'delete_transaction' && onDeleteTransaction) {
          const tx = findTransactionBySearch(transactions, action.search)
          if (!tx) {
            assistantMessage = { role: 'assistant', content: `${displayText}\n\n⚠️ ${lang === 'ru' ? `Не нашёл операцию «${action.search}»` : `Transaction "${action.search}" not found`}` }
          } else {
            const result = await onDeleteTransaction(tx.id)
            assistantMessage = { role: 'assistant', content: `${displayText}\n\n${result.error ? '⚠️ ' + failMsg(result.error) : '✅ ' + (lang === 'ru' ? 'Операция удалена.' : 'Transaction deleted.')}` }
          }
        }
      }

      const updated = [...baseMessages, assistantMessage]
      setMessages(updated)
      saveChatHistory(updated, effectiveUserId)
    } catch (err: any) {
      setError(err?.message || (lang === 'ru' ? 'Ошибка связи' : 'Connection error'))
    } finally {
      setLoading(false)
    }
  }

  function clearHistory() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    pendingRef.current = null
    localStorage.removeItem(storageKeyFor(effectiveUserId))
    for (const a of pendingAtt) {
      if (a.objectUrl) {
        try { URL.revokeObjectURL(a.objectUrl) } catch { /* ignore */ }
      }
    }
    setPendingAtt([])
    setPreviews({})
    // localStorage кэш перезапишется пустым через save-эффект; в БД чистим явно
    if (user?.id) {
      const uid = user.id
      lastSyncedRef.current = JSON.stringify([])
      queuePersist([], uid)
    }
    setMessages([])
    sentTextRef.current.clear()
    setShowConfirmDelete(false)
  }

  // === DRAG HANDLERS (mouse + touch events) ===
  const getPosFromEvent = useCallback((e: MouseEvent | Touch) => {
    return computeDragPos(
      e.clientX,
      e.clientY,
      dragOffset.current.x,
      dragOffset.current.y,
      window.innerWidth,
      window.innerHeight,
    )
  }, [])

  const onDragStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    const rect = (e.currentTarget as HTMLElement).closest('[data-chat-window]')?.getBoundingClientRect()
    if (!rect) return
    // Окно позиционируется через bottom/right: запоминаем положительные дистанции
    // от курсора до правого (rect.right - clientX) и нижнего (rect.bottom - clientY) краёв.
    dragOffset.current = { x: rect.right - e.clientX, y: rect.bottom - e.clientY }
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    setIsDragging(true)
    touchDragMoved.current = false
    e.preventDefault()
  }, [])

  const touchDragMoved = useRef(false)

  const onIconDragStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    // Иконка позиционируется через bottom/right — положительные дистанции до краёв
    dragOffset.current = { x: rect.right - e.clientX, y: rect.bottom - e.clientY }
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    touchDragMoved.current = false
    setIsDragging(true)
    e.preventDefault()
  }, [])

  const onIconTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    dragOffset.current = { x: rect.right - touch.clientX, y: rect.bottom - touch.clientY }
    dragStartRef.current = { x: touch.clientX, y: touch.clientY }
    touchDragMoved.current = false
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const onMove = (e: MouseEvent) => {
      if (!dragMovedEnough(dragStartRef.current.x, dragStartRef.current.y, e.clientX, e.clientY)) return
      touchDragMoved.current = true
      setPos(getPosFromEvent(e))
    }
    const onUp = () => setIsDragging(false)

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDragging, getPosFromEvent])

  useEffect(() => {
    if (!isDragging) return

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (!dragMovedEnough(dragStartRef.current.x, dragStartRef.current.y, touch.clientX, touch.clientY)) return
      touchDragMoved.current = true
      setPos(getPosFromEvent(touch))
    }
    const onTouchEnd = () => setIsDragging(false)

    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [isDragging, getPosFromEvent])

  // Voice input
  function startListening() {
    if (!voiceSupported) return
    stopListening()

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = lang === 'ru' ? 'ru-RU' : 'en-US'

    recognition.onresult = (event: any) => {
      let interim = ''
      let finalTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) finalTranscript += transcript
        else interim += transcript
      }
      interimRef.current = interim
      setInterimText(interim)

      if (finalTranscript.trim()) {
        const text = finalTranscript.trim()
        // Если запрос уже в полёте — текст не дропаем, а кладём в input
        if (loadingRef.current) {
          interimRef.current = ''
          setInterimText('')
          setInput(text)
          return
        }
        if (!sentTextRef.current.has(text)) {
          sentTextRef.current.add(text)
          interimRef.current = ''
          handleSendRef.current(text)
          setInterimText('')
        }
      }
    }

    recognition.onend = () => {
      recognitionRef.current = null
      setIsListening(false)
      const pending = interimRef.current
      if (pending && pending.trim() && !sentTextRef.current.has(pending.trim())) {
        const text = pending.trim()
        interimRef.current = ''
        if (loadingRef.current) {
          setInput(text)
        } else {
          handleSendRef.current(text)
        }
        setInterimText('')
        sentTextRef.current.clear()
      }
    }

    recognition.onerror = (event: any) => {
      recognitionRef.current = null
      setIsListening(false)
      const pending = interimRef.current
      if (pending) {
        interimRef.current = ''
        setInterimText('')
        sentTextRef.current.clear()
      }
      const code = event?.error as string | undefined
      const key =
        code === 'network' ? 'voiceErrorNetwork'
        : code === 'aborted' ? 'voiceErrorAborted'
        : code === 'audio-capture' ? 'voiceErrorMic'
        : code === 'not-allowed' || code === 'service-not-allowed' ? 'voiceErrorSettings'
        : code === 'language-not-supported' || code === 'language' ? 'voiceErrorLang'
        : 'voiceErrorUnknown'
      setError(t(lang, key as any))
      setTimeout(() => setError(''), 3000)
    }

    recognition.start()
    recognitionRef.current = recognition
    setIsListening(true)
  }

  function stopListening() {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch { /* ignore */ }
      recognitionRef.current = null
    }
    setIsListening(false)
  }

  // === RENDER ===
  // Приветствие НЕ хранится в state: всегда дорисовывается ПЕРВЫМ при рендере —
  // всегда одно, всегда свежее (актуальные имя, цифры, язык), никогда не уезжает в БД
  const welcomeMessage = buildWelcomeMessage()
  const displayMessages: ChatMessage[] = [
    { role: 'assistant', content: welcomeMessage },
    ...messages,
  ]

  // Chat window — на ПК перетаскиваемый, на телефоне full screen
  const chatWindow = isExpanded && (
    <div
      data-chat-window
      className="bg-white border border-zinc-200 shadow-xl overflow-hidden flex flex-col"
      style={{
        position: 'fixed',
        bottom: isMobileView ? 0 : pos.bottom,
        right: isMobileView ? 0 : pos.right,
        left: isMobileView ? 0 : undefined,
        width: isMobileView ? '100vw' : 380,
        height: isMobileView ? '100dvh' : undefined,
        maxHeight: isMobileView ? undefined : 'calc(100vh - 10rem)',
        zIndex: 50,
        borderRadius: isMobileView ? 0 : 16,
      }}
    >
      {/* Header — drag handle только на ПК */}
      {isMobileView ? (
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#7c5cff] to-[#9d7cff] text-white shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Cat className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight truncate">
                {capitalize(petName ?? '') || (lang === 'ru' ? 'Питомец' : 'Pet')}
              </p>
              <p className="text-xs text-white/70">
                {isListening
                  ? (lang === 'ru' ? 'Слушаю...' : 'Listening...')
                  : (lang === 'ru' ? 'Можно поговорить' : 'Chat with me')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={() => setShowConfirmDelete(true)}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
              title={lang === 'ru' ? 'Очистить историю' : 'Clear history'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={() => setIsExpanded(false)}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
            >
              <ChevronsDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#7c5cff] to-[#9d7cff] text-white shrink-0"
          onMouseDown={onDragStart}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Cat className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight truncate">
                {capitalize(petName ?? '') || (lang === 'ru' ? 'Питомец' : 'Pet')}
              </p>
              <p className="text-xs text-white/70">
                {isListening
                  ? (lang === 'ru' ? 'Слушаю...' : 'Listening...')
                  : (lang === 'ru' ? 'Можно поговорить' : 'Chat with me')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={() => setShowConfirmDelete(true)}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
              title={lang === 'ru' ? 'Очистить историю' : 'Clear history'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={() => setIsExpanded(false)}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
            >
              <ChevronsDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Messages — на телефоне растягиваются на весь экран, на ПК ограничены 400px */}
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-zinc-50"
        style={{ maxHeight: isMobileView ? undefined : 400 }}
      >
        {displayMessages.map((m, i) => {
          // Технические блоки вложений из показа вырезаем (в state/БД остаются для LLM)
          const parts = m.role === 'user' ? parseDisplay(m.content) : null
          const thumbs = m.role === 'user' ? (previews[m.content] ?? []) : []
          return (
            <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              {parts && parts.photos.map((name, k) => (
                thumbs[k] ? (
                  <img
                    key={`p${k}`}
                    src={thumbs[k]}
                    alt={name}
                    className="max-w-[85%] max-h-40 rounded-2xl border border-zinc-200 object-cover mb-1"
                  />
                ) : (
                  <span key={`p${k}`} className="flex items-center gap-1.5 max-w-[85%] px-2.5 py-1.5 mb-1 rounded-xl bg-violet-50 border border-violet-200 text-xs text-[#7c5cff]">
                    <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{name}</span>
                  </span>
                )
              ))}
              {parts && parts.files.map((name, k) => (
                <span key={`f${k}`} className="flex items-center gap-1.5 max-w-[85%] px-2.5 py-1.5 mb-1 rounded-xl bg-violet-50 border border-violet-200 text-xs text-[#7c5cff]">
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{name}</span>
                </span>
              ))}
              {(!parts || parts.text !== '') && (
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-[#7c5cff] text-white'
                    : 'bg-white border border-zinc-200 text-zinc-800'
                }`}>
                  {parts ? parts.text : m.content}
                </div>
              )}
            </div>
          )
        })}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-zinc-200 px-3 py-2 rounded-2xl text-sm">
              <span className="animate-pulse">...</span>
            </div>
          </div>
        )}
        {error && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-zinc-200 bg-white shrink-0">
        {interimText && !loading && (
          <p className="text-xs text-zinc-400 mb-2 flex items-center gap-1">
            <Timer className="w-3 h-3" /> {interimText}
          </p>
        )}
        {pendingAtt.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {pendingAtt.map((a, k) => (
              <span key={k} className="flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-lg bg-zinc-100 border border-zinc-200 text-xs text-zinc-700 max-w-full">
                {a.kind === 'image' && a.objectUrl ? (
                  <img src={a.objectUrl} alt="" className="w-8 h-8 rounded-md object-cover" />
                ) : (
                  <FileText className="w-4 h-4 text-zinc-500 shrink-0" />
                )}
                <span className="truncate max-w-[140px]">{a.name}</span>
                <button
                  onClick={() => setPendingAtt((prev) => prev.filter((_, j) => j !== k))}
                  className="w-5 h-5 rounded-md hover:bg-zinc-200 flex items-center justify-center shrink-0"
                  title={lang === 'ru' ? 'Убрать' : 'Remove'}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.csv,.txt,.md,.tsv,.pdf,.xls,.xlsx"
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <button
            data-tour="chat-attach"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || attaching}
            className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition flex items-center justify-center shrink-0 disabled:opacity-50"
            title={lang === 'ru' ? 'Прикрепить фото или файл' : 'Attach a photo or file'}
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            data-tour="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSend(input) }}
            placeholder={lang === 'ru' ? 'Напишите сообщение...' : 'Type a message...'}
            className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#7c5cff] outline-none text-sm min-w-0"
          />
          {voiceSupported ? (
            <button
              data-tour="chat-voice"
              onClick={isListening ? stopListening : startListening}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${
                isListening ? 'bg-red-500 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              <Mic className="w-4 h-4" />
            </button>
          ) : null}
          <button
            onClick={() => handleSend(input)}
            disabled={loading || (!input.trim() && pendingAtt.length === 0)}
            className="w-10 h-10 rounded-xl bg-[#7c5cff] text-white flex items-center justify-center disabled:opacity-50 hover:bg-[#6b4de6] transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        {!voiceSupported && (
          <p className="text-xs text-zinc-400 mt-1 text-center">
            {lang === 'ru' ? 'Голосовой ввод не поддерживается' : 'Voice input not supported'}
          </p>
        )}
      </div>
    </div>
  )

  // Collapsed button — на ПК перетаскивается, на телефоне статичная
  const collapsedButton = !isExpanded && (
    <button
      data-tour="chat"
      onMouseDown={isMobileView ? undefined : onIconDragStart}
      onTouchStart={isMobileView ? undefined : onIconTouchStart}
      onClick={() => { if (!isMobileView && touchDragMoved.current) return; setIsExpanded(true) }}
      className={`w-14 h-14 rounded-full bg-gradient-to-br from-[#7c5cff] to-[#9d7cff] text-white shadow-lg shadow-violet-200 flex items-center justify-center transition-transform ${
        !isMobileView && isDragging ? 'scale-110 cursor-grabbing' : 'hover:scale-105 active:scale-95'
      }`}
      style={{
        position: 'fixed',
        bottom: isMobileView ? 76 : pos.bottom,
        right: isMobileView ? 16 : pos.right,
        zIndex: 50,
        cursor: !isMobileView ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
      }}
      title={lang === 'ru' ? (isMobileView ? 'Нажмите' : 'Перетащите или нажмите') : (isMobileView ? 'Click' : 'Drag or click')}
    >
      <Cat className="w-7 h-7" />
    </button>
  )

  return (
    <>
      {chatWindow}
      {collapsedButton}
      <ConfirmModal
        open={showConfirmDelete}
        onCancel={() => setShowConfirmDelete(false)}
        onConfirm={clearHistory}
        title={lang === 'ru' ? 'Очистить историю чата?' : 'Clear chat history?'}
        description={lang === 'ru' ? 'Все сообщения будут удалены. Это действие нельзя отменить.' : 'All messages will be deleted. This action cannot be undone.'}
        confirmLabel={lang === 'ru' ? 'Удалить' : 'Delete'}
        cancelLabel={lang === 'ru' ? 'Отмена' : 'Cancel'}
        danger={true}
      />
    </>
  )
}
