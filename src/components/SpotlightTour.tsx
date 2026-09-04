import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { openChat, sendTourDemo } from '../utils/tourDemo'
import { Cat, ChevronLeft, ChevronRight, Check, Sparkles } from 'lucide-react'

interface StepDef {
  id: string
  /** Селекторы цели (первый видимый побеждает); пусто = центрированная карточка */
  targets: string[]
}

const ALL_STEPS: StepDef[] = [
  { id: 'balance', targets: ['[data-tour="balance"]'] },
  { id: 'pet', targets: ['[data-tour="pet"]'] },
  { id: 'goals', targets: ['[data-tour="goals"]'] },
  { id: 'nav', targets: ['[data-tour="nav"]', '[data-tour="fab"]'] },
  { id: 'chat', targets: ['[data-tour="chat"]'] },
  { id: 'petname', targets: [] },
]

type ChatPhase = 'icon' | 'input' | 'tools' | 'demo' | 'cleanup'

const CHAT_PHASE_TARGETS: Record<ChatPhase, string[]> = {
  icon: ['[data-tour="chat"]'],
  input: ['[data-tour="chat-input"]'],
  tools: ['[data-tour="chat-attach"]', '[data-tour="chat-voice"]'],
  demo: ['[data-tour="chat-input"]'],
  cleanup: ['[data-tour="chat-input"]'],
}

const CHAT_PHASES: ChatPhase[] = ['icon', 'input', 'tools', 'demo', 'cleanup']

function firstVisible(selectors: string[]): DOMRect | null {
  for (const sel of selectors) {
    const nodes = document.querySelectorAll(sel)
    for (const el of Array.from(nodes)) {
      const r = (el as HTMLElement).getBoundingClientRect()
      if (r.width > 4 && r.height > 4) return r
    }
  }
  return null
}

function stepText(id: string, lang: 'ru' | 'en', chatPhase: ChatPhase, isMobile: boolean): { title: string; text: string } {
  const ru = lang === 'ru'
  switch (id) {
    case 'balance':
      return {
        title: ru ? 'Баланс' : 'Balance',
        text: ru
          ? 'Здесь баланс за выбранный период: день, неделя, месяц, год или свой диапазон. Месяц всегда считается с 1-го числа.'
          : 'Balance for the chosen period: day, week, month, year or a custom range. A month always starts on the 1st.',
      }
    case 'pet':
      return {
        title: ru ? 'Питомец' : 'Pet',
        text: ru
          ? 'Он живой: настроение, серия дней и подсказка дня считаются из твоих записей. Веди учёт регулярно — и он будет довольным.'
          : 'It is alive: mood, streak and the daily tip come from your records. Log regularly — and it stays happy.',
      }
    case 'goals':
      return {
        title: ru ? 'Цели' : 'Goals',
        text: ru
          ? 'Прогресс накоплений. Пополнять можно и руками, и просто написав в чат.'
          : 'Savings progress. Top up manually or just by writing in chat.',
      }
    case 'nav':
      return {
        title: ru ? 'Разделы и плюс' : 'Sections and plus',
        text: isMobile
          ? (ru
            ? 'Внизу: Главная, Статистика, Цели, Профиль. Круглый плюс слева — добавить операцию вручную.'
            : 'Bottom: Home, Statistics, Goals, Profile. The round plus on the left adds a record manually.')
          : (ru
            ? 'Слева: Главная, Статистика, Цели, Профиль. Кнопка «Новая операция» — добавить вручную.'
            : 'Left: Home, Statistics, Goals, Profile. The “New operation” button adds a record manually.'),
      }
    case 'chat':
      switch (chatPhase) {
        case 'input':
          return {
            title: ru ? 'Просто напиши' : 'Just type',
            text: ru
              ? 'Сюда — что угодно человеческим языком: «кофе 250», «зарплата 80 тысяч». Категорию подберу сам.'
              : 'Anything in plain words: “coffee 5”, “salary 80000”. I pick the category myself.',
          }
        case 'tools':
          return {
            title: ru ? 'Фото и голос' : 'Photo and voice',
            text: ru
              ? 'Скрепка — чек по фото, микрофон — надиктовать трату. Распознаю и разложу сам.'
              : 'Paperclip — receipt photo, mic — dictate an expense. I recognize and sort it myself.',
          }
        case 'demo':
          return {
            title: ru ? 'Смотри, как я умею' : 'Watch me work',
            text: ru
              ? 'Сейчас сам создам запись «Кофе 250» — смотри чат.'
              : 'I will create a “Coffee 5” record myself — watch the chat.',
          }
        case 'cleanup':
          return {
            title: ru ? 'И так всегда' : 'Always like this',
            text: ru
              ? 'Запись появилась без форм. Теперь уберу её за собой — и так с любой операцией или целью.'
              : 'The record appeared with no forms. Now I will clean it up — same with any record or goal.',
          }
        default:
          return {
            title: ru ? 'Знакомься — чат' : 'Meet the chat',
            text: isMobile
              ? (ru
                ? 'Вот он — кот справа над нижней панелью. Это главная фишка: он ведёт финансы вместо форм. Заглянем внутрь?'
                : 'The cat on the right above the bottom bar. The main magic: it runs your finances instead of forms. Peek inside?')
              : (ru
                ? 'Вот он — кот в углу экрана (его можно таскать). Это главная фишка: он ведёт финансы вместо форм. Заглянем внутрь?'
                : 'The cat in the screen corner (you can drag it). The main magic: it runs your finances instead of forms. Peek inside?'),
          }
      }
    default:
      return {
        title: ru ? 'Как зовут питомца?' : 'Name your pet',
        text: ru
          ? 'Дай ему имя — он начнёт использовать его в чате. Или оставь «Питомец».'
          : 'Give it a name — it will use it in chat. Or keep “Pet”.',
      }
  }
}

export function SpotlightTour({ onDone }: { onDone: () => void }) {
  const { lang } = useSettings()
  const { setPetName } = useAuth()
  const ru = lang === 'ru'
  // Цели может не быть (нет целей) — исключаем шаг сразу
  const [steps] = useState<StepDef[]>(() => {
    if (typeof document === 'undefined') return ALL_STEPS
    const hasGoals = !!document.querySelector('[data-tour="goals"]')
    return ALL_STEPS.filter((s) => s.id !== 'goals' || hasGoals)
  })
  const [idx, setIdx] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 640,
  )
  const [petInput, setPetInput] = useState('')
  const [petSaving, setPetSaving] = useState(false)
  // Авто-показ чата: icon → input → tools → demo → cleanup (тур ведёт, юзер смотрит)
  const [chatPhase, setChatPhase] = useState<ChatPhase>('icon')
  const step = steps[idx]

  const targets = step.id === 'chat' ? CHAT_PHASE_TARGETS[chatPhase] : step.targets

  const measure = useCallback(() => {
    setIsMobile(window.innerWidth < 640)
    if (targets.length === 0) {
      setRect(null)
      return
    }
    const first = document.querySelectorAll(targets[0])[0] as HTMLElement | undefined
    // Внутренности чата уже в нужном месте — не дёргаем скролл страницы
    if (first && step.id !== 'chat') {
      try {
        first.scrollIntoView({ block: 'center', behavior: 'smooth' })
      } catch { /* ignore */ }
    }
    // Замер после скролла — следующим кадром
    requestAnimationFrame(() => setRect(firstVisible(targets)))
  }, [targets, step.id])

  useLayoutEffect(() => {
    measure()
  }, [measure, idx, chatPhase])

  useEffect(() => {
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [measure])

  // Лок скролла фона на время тура
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  function enterChatStep() {
    setChatPhase('icon')
  }

  function next() {
    if (step.id === 'chat') {
      const i = CHAT_PHASES.indexOf(chatPhase)
      if (i < CHAT_PHASES.length - 1) {
        const nextPhase = CHAT_PHASES[i + 1]
        // Со второй фазы чат должен быть открыт — открываем сами
        if (i === 0) openChat()
        setChatPhase(nextPhase)
        return
      }
    }
    if (idx >= steps.length - 1) {
      onDone()
      return
    }
    if (steps[idx + 1]?.id === 'chat') enterChatStep()
    setIdx(idx + 1)
  }

  function back() {
    if (step.id === 'chat') {
      const i = CHAT_PHASES.indexOf(chatPhase)
      if (i > 0) {
        setChatPhase(CHAT_PHASES[i - 1])
        return
      }
    }
    if (idx > 0) {
      if (steps[idx - 1]?.id === 'chat') setChatPhase('cleanup')
      setIdx(idx - 1)
    }
  }

  function runDemo() {
    sendTourDemo(ru ? 'Купил кофе за 250' : 'Bought coffee for 5')
    setChatPhase('cleanup')
  }

  function runCleanup() {
    sendTourDemo(ru ? 'Удали кофе' : 'Delete the coffee')
    if (idx >= steps.length - 1) onDone()
    else {
      if (steps[idx + 1]?.id === 'petname') setIdx(idx + 1)
      else onDone()
    }
  }

  async function savePet() {
    const v = petInput.trim()
    if (!v) {
      next()
      return
    }
    setPetSaving(true)
    await setPetName(v)
    setPetSaving(false)
    next()
  }

  const { title, text } = stepText(step.id, lang, chatPhase, isMobile)
  const isLast = idx === steps.length - 1 && (step.id !== 'chat' || chatPhase === 'cleanup')
  const pad = 8
  // Шаг имени — компактное облачко (там только инпут и две кнопки)
  const compact = step.id === 'petname'

  // Позиция облачка на десктопе: под целью, иначе над; хвостик к цели
  let tipStyle: React.CSSProperties = {}
  let below = true
  if (!isMobile && rect) {
    const w = Math.min(360, window.innerWidth - 32)
    const left = Math.min(Math.max(16, rect.left), window.innerWidth - w - 16)
    below = rect.bottom + pad + 8 + 280 <= window.innerHeight
    const top = below ? rect.bottom + pad + 8 : Math.max(16, rect.top - 290)
    tipStyle = { position: 'fixed', left, top, width: w, zIndex: 202 }
  }

  // На мобиле: цель внизу (навигация, поле ввода чата) — облачко сверху, иначе снизу
  const sheetOnTop = isMobile && !!rect && rect.top > window.innerHeight * 0.45

  const showNext = !(step.id === 'chat' && (chatPhase === 'demo' || chatPhase === 'cleanup'))

  return (
    <div className="fixed inset-0 z-[200]">
      {/* Затемнение */}
      <div className="absolute inset-0 bg-black/60" style={{ zIndex: 200 }} />
      {/* Подсветка цели */}
      {rect && (
        <div
          className="rounded-2xl border-2 border-violet-300 animate-pulse"
          style={{
            position: 'fixed',
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            zIndex: 201,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
            pointerEvents: 'none',
          }}
        />
      )}
      {/* Облачко питомца — полупрозрачное */}
      <div
        className={
          isMobile || !rect
            ? isMobile && sheetOnTop
              ? `absolute inset-x-0 top-0 rounded-b-3xl bg-white/80 backdrop-blur-2xl shadow-2xl ${compact ? 'p-4 space-y-3' : 'p-5 space-y-4'}`
              : `absolute inset-x-0 bottom-0 rounded-t-3xl bg-white/80 backdrop-blur-2xl shadow-2xl ${compact ? 'p-4 space-y-3' : 'p-5 space-y-4'}`
            : `rounded-3xl bg-white/80 backdrop-blur-2xl shadow-2xl ${compact ? 'p-4 space-y-3' : 'p-5 space-y-4'} relative`
        }
        style={isMobile || !rect ? { zIndex: 202 } : tipStyle}
      >
        {/* Хвостик облачка к подсвеченной зоне (десктоп) */}
        {!isMobile && rect && (
          <div
            className="absolute w-4 h-4 bg-white/80 rotate-45"
            style={
              below
                ? { top: -8, left: 40 }
                : { bottom: -8, left: 40 }
            }
          />
        )}
        {/* Прогресс */}
        <div className="flex gap-1.5">
          {steps.map((s, i) => (
            <div
              key={s.id}
              className={`h-1 flex-1 rounded-full ${i <= idx ? 'bg-[#7c5cff]' : 'bg-zinc-200'}`}
            />
          ))}
        </div>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#7c5cff]/10 flex items-center justify-center shrink-0">
            <Cat className="w-5 h-5 text-[#7c5cff]" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-zinc-900">{title}</h3>
            <p className="text-sm text-zinc-600 leading-relaxed mt-1">{text}</p>
          </div>
        </div>

        {step.id === 'chat' && chatPhase === 'demo' && (
          <button
            onClick={runDemo}
            className="w-full py-2.5 rounded-xl bg-[#7c5cff] text-white text-sm font-medium hover:bg-[#6b4de6] transition flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {ru ? 'Покажи магию' : 'Show me the magic'}
          </button>
        )}

        {step.id === 'chat' && chatPhase === 'cleanup' && (
          <button
            onClick={runCleanup}
            className="w-full py-2.5 rounded-xl bg-[#7c5cff] text-white text-sm font-medium hover:bg-[#6b4de6] transition"
          >
            {ru ? 'Убери за собой' : 'Clean it up'}
          </button>
        )}

        {step.id === 'petname' && (
          <div className="flex gap-2">
            <input
              type="text"
              value={petInput}
              onChange={(e) => setPetInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void savePet() }}
              placeholder={ru ? 'Например: Барсик' : 'e.g. Whiskers'}
              maxLength={40}
              autoFocus
              className="flex-1 px-3 py-2.5 rounded-xl border border-zinc-200 bg-white/70 focus:bg-white focus:border-[#7c5cff] outline-none text-sm"
            />
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onDone}
            className="px-4 py-3 rounded-xl text-sm text-zinc-500 hover:text-zinc-700 transition"
          >
            {ru ? 'Пропустить' : 'Skip'}
          </button>
          <div className="flex-1" />
          {(idx > 0 || (step.id === 'chat' && chatPhase !== 'icon')) && (
            <button
              onClick={back}
              className="px-4 py-3 rounded-xl border border-zinc-200 bg-white/60 text-sm font-medium text-zinc-700 flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> {ru ? 'Назад' : 'Back'}
            </button>
          )}
          {step.id === 'petname' ? (
            <button
              onClick={() => void savePet()}
              disabled={petSaving}
              className="px-5 py-3 rounded-xl bg-[#7c5cff] text-white text-sm font-medium hover:bg-[#6b4de6] transition disabled:opacity-60 flex items-center gap-1"
            >
              <Check className="w-4 h-4" />
              {petInput.trim() ? (ru ? 'Сохранить' : 'Save') : (ru ? 'Оставить «Питомец»' : 'Keep “Pet”')}
            </button>
          ) : showNext ? (
            <button
              onClick={next}
              className="px-5 py-3 rounded-xl bg-[#7c5cff] text-white text-sm font-medium hover:bg-[#6b4de6] transition flex items-center gap-1"
            >
              {isLast ? (ru ? 'Готово' : 'Done') : (ru ? 'Далее' : 'Next')}
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : null}
        </div>
        <p className="text-center text-xs text-zinc-400">{idx + 1} / {steps.length}</p>
      </div>
    </div>
  )
}

// Хук-мост живёт в utils/tourDemo.ts (рядом с событием), чтобы файл
// экспортировал только компонент для fast refresh.
