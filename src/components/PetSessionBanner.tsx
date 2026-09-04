import { useState, useEffect } from 'react'
import { useSettings } from '../contexts/SettingsContext'
import { Sparkles, X, MessagesSquare, Timer } from 'lucide-react'

const SESSION_DURATION = 5 * 60 * 1000 // 5 минут

// Сессия изолирована по пользователю
function sessionKeyFor(userId?: string | null): string {
  return userId ? `pet_session_data_${userId}` : 'pet_session_data_guest'
}

interface SessionData {
  startTime: number
  messageCount: number
  lastInteraction: number
}

interface Props {
  userId?: string | null
}

export function PetSessionBanner({ userId }: Props) {
  const { lang } = useSettings()
  const [session, setSession] = useState<SessionData | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [timeLeft, setTimeLeft] = useState({ minutes: 0, seconds: 0 })

  // Load session from localStorage (user-scoped)
  useEffect(() => {
    const key = sessionKeyFor(userId)
    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        const data = JSON.parse(saved) as SessionData
        if (!data || !Number.isFinite(data.startTime) || typeof data.messageCount !== 'number' || !Number.isFinite(data.messageCount) || data.messageCount < 0) {
          localStorage.removeItem(key)
          setSession(null)
          setShowBanner(false)
          return
        }
        const elapsed = Date.now() - data.startTime

        if (elapsed > SESSION_DURATION) {
          // Session expired
          localStorage.removeItem(key)
          setSession(null)
          return
        }

        setSession(data)
        setShowBanner(true)
        updateTimeLeft(data)
      } catch {
        localStorage.removeItem(key)
      }
    } else {
      setSession(null)
      setShowBanner(false)
    }
  }, [userId])

  // Update timer
  useEffect(() => {
    if (!session) return

    const interval = setInterval(() => {
      const elapsed = Date.now() - session.startTime
      const remaining = Math.max(0, SESSION_DURATION - elapsed)

      if (remaining <= 0) {
        setShowBanner(false)
        localStorage.removeItem(sessionKeyFor(userId))
        setSession(null)
        clearInterval(interval)
      } else {
        updateTimeLeft(session, remaining)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [session, userId])

  function updateTimeLeft(data: SessionData, overrideRemaining?: number) {
    const elapsed = Date.now() - data.startTime
    const remaining = overrideRemaining ?? Math.max(0, SESSION_DURATION - elapsed)
    const minutes = Math.floor(remaining / 60000)
    const seconds = Math.floor((remaining % 60000) / 1000)
    setTimeLeft({ minutes, seconds })
  }

  function updateSession() {
    if (!session) {
      const next: SessionData = {
        startTime: Date.now(),
        messageCount: 0,
        lastInteraction: Date.now(),
      }
      setSession(next)
      setShowBanner(true)
      localStorage.setItem(sessionKeyFor(userId), JSON.stringify(next))
      return
    }

    const updated = {
      ...session,
      messageCount: session.messageCount + 1,
      lastInteraction: Date.now(),
    }
    setSession(updated)
    localStorage.setItem(sessionKeyFor(userId), JSON.stringify(updated))
  }

  function closeBanner() {
    setShowBanner(false)
  }

  if (!showBanner || !session) return null

  const stats = [
    {
      label: lang === 'ru' ? 'Сообщений' : 'Messages',
      value: session.messageCount.toString(),
      icon: <MessagesSquare className="w-4 h-4 text-[#7c5cff]" />,
    },
    {
      label: lang === 'ru' ? 'Время сессии' : 'Session time',
      value: `${timeLeft.minutes}:${timeLeft.seconds.toString().padStart(2, '0')}`,
      icon: <Timer className="w-4 h-4 text-[#7c5cff]" />,
    },
  ]

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-sm animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-white rounded-2xl shadow-lg border border-zinc-200 p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7c5cff] to-[#9d7cff] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                {lang === 'ru' ? 'Сессия питомца' : 'Pet session'}
              </p>
              <p className="text-xs text-zinc-500">
                {lang === 'ru' ? 'Активна' : 'Active'}
              </p>
            </div>
          </div>
          <button
            onClick={closeBanner}
            className="w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition"
          >
            <X className="w-3.5 h-3.5 text-zinc-500" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-zinc-50 rounded-xl p-2.5 text-center">
              <div className="flex items-center justify-center gap-1">
                {stat.icon}
                <p className="text-sm font-bold text-zinc-900">{stat.value}</p>
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={() => {
            updateSession()
            closeBanner()
          }}
          className="w-full py-2.5 rounded-xl bg-[#7c5cff] text-white text-sm font-medium hover:bg-[#6b4de6] transition"
        >
          {lang === 'ru' ? 'Открыть чат' : 'Open chat'}
        </button>
      </div>
    </div>
  )
}
