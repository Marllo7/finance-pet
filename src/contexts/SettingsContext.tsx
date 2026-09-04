import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'
import type { CurrencyCode } from '../utils/currencies'
import type { Lang } from '../i18n'

interface SettingsValue {
  currency: CurrencyCode
  lang: Lang
  setCurrency: (c: CurrencyCode) => void
  setLang: (l: Lang) => void
}

const VALID_CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'RUB', 'GBP', 'KZT']
const VALID_LANGS: Lang[] = ['ru', 'en']

const SettingsContext = createContext<SettingsValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [currency, setCurrencyState] = useState<CurrencyCode>('EUR')
  const [lang, setLangState] = useState<Lang>('ru')

  // Load from localStorage on mount (cache for fast first paint)
  useEffect(() => {
    const localCurrency = localStorage.getItem('fp_currency')
    const localLang = localStorage.getItem('fp_lang')
    if (localCurrency && (VALID_CURRENCIES as string[]).includes(localCurrency)) {
      setCurrencyState(localCurrency as CurrencyCode)
    }
    if (localLang && (VALID_LANGS as string[]).includes(localLang)) {
      setLangState(localLang as Lang)
    }
  }, [])

  // Sync from DB on every login — DB is the source of truth across devices.
  // IMPORTANT: also refresh localStorage cache, otherwise a stale cache
  // wins on the next reload / other device and the setting "resets".
  // Per-user cache is applied IMMEDIATELY on login (before DB-fetch),
  // so another user's values never flash. Logout keeps state untouched.
  useEffect(() => {
    if (!user?.id) return
    const uid = user.id
    const perUserCurrency = localStorage.getItem(`fp_currency_${uid}`)
    if (perUserCurrency && (VALID_CURRENCIES as string[]).includes(perUserCurrency)) {
      setCurrencyState(perUserCurrency as CurrencyCode)
    }
    const perUserLang = localStorage.getItem(`fp_lang_${uid}`)
    if (perUserLang && (VALID_LANGS as string[]).includes(perUserLang)) {
      setLangState(perUserLang as Lang)
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.from('profiles').select('currency, language').eq('id', uid).single()
      if (cancelled || error || !data) return
      const c = data.currency as CurrencyCode | null
      const l = data.language as Lang | null
      if (c && (VALID_CURRENCIES as string[]).includes(c)) {
        setCurrencyState(c)
        localStorage.setItem('fp_currency', c)
        localStorage.setItem(`fp_currency_${uid}`, c)
      }
      if (l && (VALID_LANGS as string[]).includes(l)) {
        setLangState(l)
        localStorage.setItem('fp_lang', l)
        localStorage.setItem(`fp_lang_${uid}`, l)
      }
    })()
    return () => { cancelled = true }
  }, [user?.id])

  const setCurrencyFn = (c: CurrencyCode) => {
    setCurrencyState(c)
    localStorage.setItem('fp_currency', c)
    if (user?.id) {
      localStorage.setItem(`fp_currency_${user.id}`, c)
      void supabase.from('profiles').upsert({ id: user.id, currency: c }, { onConflict: 'id' })
        .then(({ error }) => { if (error) console.warn('currency sync failed:', error.message) })
    }
  }

  const setLangFn = (l: Lang) => {
    setLangState(l)
    localStorage.setItem('fp_lang', l)
    if (user?.id) {
      localStorage.setItem(`fp_lang_${user.id}`, l)
      void supabase.from('profiles').upsert({ id: user.id, language: l }, { onConflict: 'id' })
        .then(({ error }) => { if (error) console.warn('language sync failed:', error.message) })
    }
  }

  return <SettingsContext.Provider value={{currency, lang, setCurrency: setCurrencyFn, setLang: setLangFn}}>{children}</SettingsContext.Provider>
}

export function useSettings(){
  const ctx = useContext(SettingsContext)
  if(!ctx) throw new Error('useSettings outside provider')
  return ctx
}
