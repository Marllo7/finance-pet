import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { t } from '../i18n'
import { Eye, EyeOff } from 'lucide-react'

export function AuthPage() {
  const { signIn, signUp } = useAuth()
  const { lang, setLang } = useSettings()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!email.trim() || !password) {
      setError(lang==='ru'?'Введите email и пароль':'Enter email and password')
      return
    }
    // Минимум 6 символов — требование Supabase к НОВОМУ паролю, только для регистрации.
    // При входе не проверяем: иначе заблокируем пользователей со старыми короткими паролями.
    if (mode === 'register' && password.length < 6) {
      setError(lang==='ru'?'Пароль минимум 6 символов':'Password must be at least 6 characters')
      return
    }
    setLoading(true)
    const fn = mode === 'login' ? signIn : signUp
    const { error: err } = await fn(email.trim(), password)
    setLoading(false)
    if (err) {
      if (err.includes('Invalid login credentials')) setError(lang==='ru'?'Неверный email или пароль':'Invalid email or password')
      else if (err.includes('already registered')) setError(lang==='ru'?'Пользователь уже зарегистрирован':'User is already registered')
      else if (err.includes('Email not confirmed')) setError(lang==='ru'?'Подтвердите email (проверьте почту)':'Confirm your email (check your inbox)')
      else setError(err)
    } else if (mode === 'register') {
      // Имя спросим уже внутри приложения (NameStep после входа, с кнопкой пропуска)
      setInfo(t(lang,'authCreated'))
      setMode('login')
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-[420px] bg-white rounded-[20px] border border-zinc-200 shadow-sm p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#7c5cff] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
              </svg>
            </div>
            <div>
              <h1 className="font-semibold leading-none">Finance Pet</h1>
              <p className="text-xs text-zinc-500">{t(lang,'authTitle')}</p>
            </div>
          </div>
          <div className="flex gap-1 p-1 bg-zinc-100 rounded-full">
            <button onClick={()=>setLang('ru')} className={`px-2.5 py-1 rounded-full text-xs ${lang==='ru'?'bg-white shadow-sm':''}`}>RU</button>
            <button onClick={()=>setLang('en')} className={`px-2.5 py-1 rounded-full text-xs ${lang==='en'?'bg-white shadow-sm':''}`}>EN</button>
          </div>
        </div>

        {(
          <>
            <div className="flex gap-2 p-1 bg-zinc-100 rounded-xl mb-6">
              <button
                onClick={() => setMode('login')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${mode === 'login' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}
              >
                {t(lang,'login')}
              </button>
              <button
                onClick={() => setMode('register')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${mode === 'register' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}
              >
                {t(lang,'register')}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-zinc-700 block mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#7c5cff] focus:ring-4 focus:ring-violet-100 outline-none transition text-[15px]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-700 block mb-1.5">{t(lang,'password')}</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-3 pr-10 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#7c5cff] focus:ring-4 focus:ring-violet-100 outline-none transition text-[15px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {mode === 'register' && <p className="text-xs text-zinc-400 mt-1">{t(lang,'authMin6')}</p>}
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              {info && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{info}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[#7c5cff] hover:bg-[#6b4de6] disabled:opacity-60 text-white font-medium transition"
              >
                {loading ? t(lang,'authLoading') : mode === 'login' ? t(lang,'login') : t(lang,'register')}
              </button>
            </form>

            <p className="text-xs text-zinc-400 text-center mt-4">
              {t(lang,'authAgree')}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
