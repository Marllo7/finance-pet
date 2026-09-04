import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { UserRound } from 'lucide-react'

/** Первый шаг после входа: "Как тебя зовут?" — пропуск = "Пользователь". */
export function NameStep({ onDone }: { onDone: () => void }) {
  const { setUserName } = useAuth()
  const { lang } = useSettings()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const ru = lang === 'ru'

  async function submit() {
    const v = name.trim()
    if (!v) {
      onDone()
      return
    }
    setSaving(true)
    setError('')
    const { error: err } = await setUserName(v)
    setSaving(false)
    if (err) {
      setError(err)
      return
    }
    onDone()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      <div className="relative bg-white w-full max-w-[420px] rounded-3xl shadow-2xl p-6 space-y-5">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-[#7c5cff]/10 flex items-center justify-center mx-auto mb-3">
            <UserRound className="w-8 h-8 text-[#7c5cff]" />
          </div>
          <h2 className="text-lg font-bold text-zinc-900">
            {ru ? 'Как тебя зовут?' : 'What is your name?'}
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            {ru ? 'Питомец хочет знать, как к тебе обращаться' : 'Your pet wants to know how to address you'}
          </p>
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
          placeholder={ru ? 'Твоё имя' : 'Your name'}
          autoFocus
          maxLength={40}
          className="w-full px-3 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#7c5cff] focus:ring-4 focus:ring-violet-100 outline-none transition text-[15px]"
        />
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-3">
          <button
            onClick={onDone}
            className="flex-1 py-3 rounded-xl border border-zinc-200 bg-white font-medium text-zinc-700 hover:bg-zinc-50 transition"
          >
            {ru ? 'Пропустить' : 'Skip'}
          </button>
          <button
            onClick={() => void submit()}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-[#7c5cff] text-white font-medium hover:bg-[#6b4de6] disabled:opacity-60 transition"
          >
            {saving ? '...' : (ru ? 'Продолжить' : 'Continue')}
          </button>
        </div>
      </div>
    </div>
  )
}
