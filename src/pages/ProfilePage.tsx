import type { Category } from '../types/transaction'
import { useSettings } from '../contexts/SettingsContext'
import { useAuth } from '../contexts/AuthContext'
import { currencies, getCurrencyLabel } from '../utils/currencies'
import { localizeCategoryLabel } from '../utils/categories'
import { t } from '../i18n'
import { User, DollarSign, Globe, Settings, Trash2, X, Cat, LifeBuoy, Bug, Lightbulb, Heart, Send, Archive, ArchiveRestore, ChevronDown } from 'lucide-react'
import { useState, useEffect } from 'react'
import { ConfirmModal } from '../components/ConfirmModal'
import { capitalize } from '../utils/capitalize'
import { supabase } from '../lib/supabase'
import { useIsAdmin } from '../hooks/useIsAdmin'

const typeLabels: Record<string, { ru: string; en: string }> = {
  expense: { ru: 'расход', en: 'expense' },
  income: { ru: 'доход', en: 'income' },
  both: { ru: 'расход/доход', en: 'expense/income' },
}

export function ProfilePage({ categories, onDelete, onAdmin }: { categories: Category[]; onDelete?: (id:string)=>void|Promise<void>; onAdmin?: () => void }) {
  const { currency, setCurrency, lang, setLang } = useSettings()
  const { userName, setUserName, petName, setPetName, user } = useAuth()
  const isAdmin = useIsAdmin(user?.id)
  const [nameInput, setNameInput] = useState(userName ?? '')
  const [isEditingName, setIsEditingName] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [petNameInput, setPetNameInput] = useState(petName ?? '')
  const [isEditingPetName, setIsEditingPetName] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [petError, setPetError] = useState('')
  const [deleteError, setDeleteError] = useState('')

  // Синхронизируем input с контекстом при изменении
  useEffect(() => { setPetNameInput(petName ?? '') }, [petName])
  useEffect(() => { setNameInput(userName ?? '') }, [userName])

  // --- Поддержка / обратная связь ---
  type FeedbackKind = 'bug' | 'idea' | 'thanks'
  interface FeedbackRow { id: string; kind: FeedbackKind; message: string; status: string; admin_reply: string | null; archived: boolean; created_at: string }
  const [fbKind, setFbKind] = useState<FeedbackKind>('idea')
  const [fbText, setFbText] = useState('')
  const [fbSending, setFbSending] = useState(false)
  const [fbError, setFbError] = useState('')
  const [fbOk, setFbOk] = useState(false)
  const [fbList, setFbList] = useState<FeedbackRow[]>([])
  const [fbExpanded, setFbExpanded] = useState(false)
  const [fbArchiveExpanded, setFbArchiveExpanded] = useState(false)
  const [fbDeleteId, setFbDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase
          .from('feedback')
          .select('id, kind, message, status, admin_reply, archived, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20)
        if (!cancelled && Array.isArray(data)) setFbList(data as FeedbackRow[])
      } catch { /* таблица может быть не применена — молча */ }
    })()
    return () => { cancelled = true }
  }, [user?.id])

  async function sendFeedback() {
    setFbError('')
    setFbOk(false)
    const msg = fbText.trim()
    if (msg.length < 3) {
      setFbError(lang === 'ru' ? 'Опиши чуть подробнее (от 3 символов)' : 'Please add a bit more detail (3+ chars)')
      return
    }
    if (!user?.id) {
      setFbError(lang === 'ru' ? 'Войди, чтобы отправить отзыв' : 'Sign in to send feedback')
      return
    }
    setFbSending(true)
    try {
      // Best-effort антиспам: не больше 5 за час
      const hourAgo = new Date(Date.now() - 3_600_000).toISOString()
      const { count } = await supabase
        .from('feedback')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', hourAgo)
      if ((count ?? 0) >= 5) {
        setFbError(lang === 'ru' ? 'Слишком часто — попробуй через час' : 'Too frequent — try again in an hour')
        return
      }
      const { data, error } = await supabase
        .from('feedback')
        .insert({ user_id: user.id, kind: fbKind, message: msg.slice(0, 1000) })
        .select('id, kind, message, status, admin_reply, archived, created_at')
        .single()
      if (error) {
        setFbError(error.message)
        return
      }
      setFbText('')
      setFbOk(true)
      if (data) setFbList((prev) => [data as FeedbackRow, ...prev].slice(0, 20))
      setTimeout(() => setFbOk(false), 4000)
    } finally {
      setFbSending(false)
    }
  }

  const fbKinds: { id: FeedbackKind; ru: string; en: string }[] = [
    { id: 'bug', ru: 'Проблема', en: 'Bug' },
    { id: 'idea', ru: 'Идея', en: 'Idea' },
    { id: 'thanks', ru: 'Спасибо', en: 'Thanks' },
  ]
  const fbStatus = (s: string) =>
    s === 'done' ? (lang === 'ru' ? 'готово' : 'done')
    : s === 'progress' ? (lang === 'ru' ? 'в работе' : 'in progress')
    : (lang === 'ru' ? 'новое' : 'new')

  async function toggleArchiveFb(id: string, archived: boolean) {
    setFbList((prev) => prev.map((f) => (f.id === id ? { ...f, archived: !archived } : f)))
    const { error } = await supabase.from('feedback').update({ archived: !archived }).eq('id', id)
    if (error) {
      setFbList((prev) => prev.map((f) => (f.id === id ? { ...f, archived } : f)))
      setFbError(error.message)
    }
  }

  async function deleteFeedback() {
    if (!fbDeleteId) return
    const id = fbDeleteId
    setFbDeleteId(null)
    // Мягкое удаление: у юзера пропадает сразу, у админа остаётся с пометкой
    setFbList((prev) => prev.filter((f) => f.id !== id))
    const { error } = await supabase.from('feedback').update({ user_deleted: true }).eq('id', id)
    if (error) setFbError(error.message)
  }

  const fbActive = fbList.filter((f) => !f.archived)
  const fbArchived = fbList.filter((f) => f.archived)

  async function savePetName() {
    setPetError('')
    const { error } = await setPetName(petNameInput.trim() || null)
    if (error) {
      setPetError(error)
      return
    }
    setIsEditingPetName(false)
  }

  async function saveName() {
    setSaveError('')
    if (!nameInput.trim()) {
      setSaveError(lang === 'ru' ? 'Введите имя' : 'Enter name')
      return
    }
    const { error } = await setUserName(nameInput.trim())
    if (error) {
      setSaveError(error)
      return
    }
    setIsEditingName(false)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-[22px] font-bold">{lang === 'ru' ? 'Профиль' : 'Profile'}</h1>
      
      {/* Profile section */}
      <div className="bg-white rounded-[20px] border border-zinc-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#7c5cff]/10 flex items-center justify-center">
            <User className="w-8 h-8 text-[#7c5cff]" />
          </div>
          <div className="flex-1">
            {isEditingName ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder={lang === 'ru' ? 'Ваше имя' : 'Your name'}
                  className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#7c5cff] outline-none text-sm"
                  autoFocus
                />
                <button onClick={saveName} className="px-3 py-2 rounded-xl bg-[#7c5cff] text-white text-sm font-medium">
                  {lang === 'ru' ? 'OK' : 'OK'}
                </button>
                <button onClick={() => { setIsEditingName(false); setNameInput(userName ?? ''); setSaveError('') }} className="px-3 py-2 rounded-xl bg-zinc-100 text-zinc-600 text-sm">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold">{capitalize(userName || '') || (lang === 'ru' ? 'Не указано' : 'Not set')}</p>
                <button onClick={() => setIsEditingName(true)} className="text-xs text-[#7c5cff] underline">
                  {lang === 'ru' ? 'Изменить' : 'Edit'}
                </button>
              </div>
            )}
            {user && <p className="text-sm text-zinc-500">{user.email}</p>}
            {saveError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">{saveError}</p>}
          </div>
        </div>

        {/* Pet name section */}
        <div className="border-t border-zinc-100 pt-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#7c5cff]/10 flex items-center justify-center">
              <Cat className="w-6 h-6 text-[#7c5cff]" />
            </div>
            <div className="flex-1">
              {isEditingPetName ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={petNameInput}
                    onChange={(e) => setPetNameInput(e.target.value)}
                    placeholder={lang === 'ru' ? 'Имя питомца' : 'Pet name'}
                    className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#7c5cff] outline-none text-sm"
                    autoFocus
                  />
                  <button onClick={savePetName} className="px-3 py-2 rounded-xl bg-[#7c5cff] text-white text-sm font-medium">
                    {lang === 'ru' ? 'OK' : 'OK'}
                  </button>
                  <button onClick={() => { setIsEditingPetName(false); setPetNameInput(petName ?? ''); setPetError('') }} className="px-3 py-2 rounded-xl bg-zinc-100 text-zinc-600 text-sm">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-zinc-700">
                    {capitalize(petName || '') || (lang === 'ru' ? 'Питомец' : 'Pet')}
                  </p>
                  <button onClick={() => setIsEditingPetName(true)} className="text-xs text-[#7c5cff] underline">
                    {lang === 'ru' ? 'Изменить' : 'Edit'}
                  </button>
                </div>
              )}
              <p className="text-xs text-zinc-400 mt-1">{lang === 'ru' ? 'Питомец будет использовать это имя' : 'Your pet will use this name'}</p>
              {petError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">{petError}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Settings section */}
      <div className="bg-white rounded-[20px] border border-zinc-200 p-6 shadow-sm space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Settings className="w-4 h-4" />
          {lang === 'ru' ? 'Настройки' : 'Settings'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1.5 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> {t(lang,'currency')}
            </label>
            <select value={currency} onChange={e=>setCurrency(e.target.value as any)} className="w-full px-3 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#7c5cff] outline-none">
              {currencies.map(c=> <option key={c.code} value={c.code}>{c.symbol} {c.code} — {getCurrencyLabel(c.code, lang)}</option>)}
            </select>
            <p className="text-xs text-zinc-400 mt-1">{t(lang,'currencyDesc')}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> {t(lang,'language')}
            </label>
            <select value={lang} onChange={e=>setLang(e.target.value as any)} className="w-full px-3 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#7c5cff] outline-none">
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>

      {/* Help section */}
      <div className="bg-white rounded-[20px] border border-zinc-200 p-6 shadow-sm space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <LifeBuoy className="w-4 h-4" />
          {lang === 'ru' ? 'Помощь' : 'Help'}
        </h3>
        <button
          onClick={() => window.dispatchEvent(new Event('fp-tour-restart'))}
          className="w-full py-3 rounded-xl border border-zinc-200 bg-white font-medium text-zinc-700 hover:bg-zinc-50 transition text-sm"
        >
          {lang === 'ru' ? 'Пройти обучение заново' : 'Replay the tour'}
        </button>
        {isAdmin && onAdmin && (
          <button
            onClick={onAdmin}
            className="w-full py-3 rounded-xl bg-[#7c5cff] text-white font-medium hover:bg-[#6b4de6] transition text-sm"
          >
            {lang === 'ru' ? 'Админ-панель: обращения' : 'Admin: feedback inbox'}
          </button>
        )}
      </div>

      {/* Feedback section */}
      <div className="bg-white rounded-[20px] border border-zinc-200 p-6 shadow-sm space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Send className="w-4 h-4" />
            {lang === 'ru' ? 'Обратная связь' : 'Feedback'}
          </h3>
          <p className="text-sm text-zinc-500 mt-1">
            {lang === 'ru' ? 'Нашёл ошибку или есть идея? Напиши — мы читаем всё.' : 'Found a bug or have an idea? Write to us — we read everything.'}
          </p>
        </div>
        <div className="flex gap-2">
          {fbKinds.map((k) => {
            const Icon = k.id === 'bug' ? Bug : k.id === 'idea' ? Lightbulb : Heart
            const active = fbKind === k.id
            return (
              <button
                key={k.id}
                onClick={() => setFbKind(k.id)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium flex items-center justify-center gap-1.5 transition ${
                  active
                    ? 'border-[#7c5cff] bg-violet-50 text-[#7c5cff]'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {lang === 'ru' ? k.ru : k.en}
              </button>
            )
          })}
        </div>
        <textarea
          value={fbText}
          onChange={(e) => setFbText(e.target.value)}
          placeholder={lang === 'ru' ? 'Опиши проблему или идею...' : 'Describe the issue or idea...'}
          maxLength={1000}
          rows={3}
          className="w-full px-3 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#7c5cff] outline-none text-sm resize-none"
        />
        {fbError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{fbError}</p>}
        {fbOk && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            {lang === 'ru' ? 'Спасибо! Мы всё читаем.' : 'Thank you! We read everything.'}
          </p>
        )}
        <button
          onClick={() => void sendFeedback()}
          disabled={fbSending}
          className="w-full py-3 rounded-xl bg-[#7c5cff] hover:bg-[#6b4de6] disabled:opacity-60 text-white font-medium transition text-sm"
        >
          {fbSending ? '...' : (lang === 'ru' ? 'Отправить' : 'Send')}
        </button>
        {fbList.length > 0 && (
          <div className="pt-1">
            <button
              onClick={() => setFbExpanded((v) => !v)}
              className="w-full flex items-center justify-between py-2 text-xs font-medium text-zinc-500 uppercase tracking-wide"
            >
              <span>{lang === 'ru' ? `Мои обращения (${fbActive.length})` : `My requests (${fbActive.length})`}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${fbExpanded ? 'rotate-180' : ''}`} />
            </button>
            {fbExpanded && (
              <div className="space-y-2">
                {fbActive.length === 0 && (
                  <p className="text-sm text-zinc-400 text-center py-2">
                    {lang === 'ru' ? 'Активных нет.' : 'Nothing active.'}
                  </p>
                )}
                {fbActive.map((f) => (
                  <div key={f.id} className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-[#7c5cff]">
                        {fbKinds.find((k) => k.id === f.kind) ? (lang === 'ru' ? fbKinds.find((k) => k.id === f.kind)!.ru : fbKinds.find((k) => k.id === f.kind)!.en) : f.kind}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-zinc-200 text-zinc-500">
                        {fbStatus(f.status)}
                      </span>
                      <span className="ml-auto flex gap-1">
                        <button
                          onClick={() => void toggleArchiveFb(f.id, f.archived)}
                          className="w-7 h-7 rounded-lg hover:bg-zinc-200 flex items-center justify-center text-zinc-500"
                          title={lang === 'ru' ? 'В архив' : 'Archive'}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setFbDeleteId(f.id)}
                          className="w-7 h-7 rounded-lg hover:bg-red-100 flex items-center justify-center text-zinc-500 hover:text-red-600"
                          title={lang === 'ru' ? 'Удалить' : 'Delete'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    </div>
                    <p className="text-sm text-zinc-700 line-clamp-3">{f.message}</p>
                    {f.admin_reply && (
                      <p className="text-sm text-zinc-700 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 mt-2 whitespace-pre-wrap">
                        <span className="block text-[11px] font-medium text-[#7c5cff] mb-0.5">
                          {lang === 'ru' ? 'Ответ:' : 'Reply:'}
                        </span>
                        {f.admin_reply}
                      </p>
                    )}
                  </div>
                ))}
                {fbArchived.length > 0 && (
                  <div>
                    <button
                      onClick={() => setFbArchiveExpanded((v) => !v)}
                      className="w-full flex items-center justify-between py-2 text-xs text-zinc-400"
                    >
                      <span>{lang === 'ru' ? `Архив (${fbArchived.length})` : `Archive (${fbArchived.length})`}</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${fbArchiveExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {fbArchiveExpanded && (
                      <div className="space-y-2">
                        {fbArchived.map((f) => (
                          <div key={f.id} className="p-3 rounded-xl bg-zinc-50/60 border border-zinc-200 opacity-75">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm text-zinc-600 line-clamp-2 flex-1">{f.message}</p>
                              <button
                                onClick={() => void toggleArchiveFb(f.id, f.archived)}
                                className="w-7 h-7 rounded-lg hover:bg-zinc-200 flex items-center justify-center text-zinc-500 shrink-0"
                                title={lang === 'ru' ? 'Вернуть' : 'Restore'}
                              >
                                <ArchiveRestore className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setFbDeleteId(f.id)}
                                className="w-7 h-7 rounded-lg hover:bg-red-100 flex items-center justify-center text-zinc-500 hover:text-red-600 shrink-0"
                                title={lang === 'ru' ? 'Удалить' : 'Delete'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm delete feedback */}
      <ConfirmModal
        open={!!fbDeleteId}
        title={lang === 'ru' ? 'Удалить обращение?' : 'Delete request?'}
        description={lang === 'ru' ? 'Это действие нельзя отменить.' : 'This action cannot be undone.'}
        confirmLabel={t(lang, 'delete')}
        onCancel={() => setFbDeleteId(null)}
        onConfirm={() => void deleteFeedback()}
      />

      {/* Categories section */}
      <div className="bg-white rounded-[20px] border border-zinc-200 p-6 shadow-sm">
        <h3 className="font-semibold mb-1">{t(lang,'settingsCategoriesTitle')}</h3>
        <p className="text-sm text-zinc-500 mb-4">{t(lang,'settingsCategoriesDesc')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {categories.map(c=>(
            <div key={c.id} className="flex items-center gap-2 p-3 rounded-xl border border-zinc-200 bg-zinc-50">
              <span className="text-lg w-8 text-center">{c.icon}</span>
              <span className="text-sm font-medium flex-1">{localizeCategoryLabel(c, lang)}</span>
              <span className="text-xs text-zinc-400">{typeLabels[c.type]?.[lang] ?? c.type}</span>
              {onDelete && !c.isDefault && (
                <button 
                  onClick={() => setConfirmDelete(c.id)} 
                  className="text-xs text-red-500 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> {t(lang,'delete')}
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-400 mt-3">{t(lang,'deleteOnlyOwn')}</p>
        {deleteError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">{deleteError}</p>}
      </div>

      {/* Confirm delete modal */}
      {confirmDelete && (
        <ConfirmModal
          open={!!confirmDelete}
          title={lang === 'ru' ? 'Удалить категорию?' : 'Delete category?'}
          description={lang === 'ru' ? 'Это действие нельзя отменить.' : 'This action cannot be undone.'}
          confirmLabel={t(lang, 'delete')}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            if (!confirmDelete) return
            setDeleteError('')
            try {
              const res = (await onDelete?.(confirmDelete)) as unknown as { error?: string | null } | undefined
              if (res && typeof res === 'object' && 'error' in res && res.error) {
                setDeleteError(res.error)
                return
              }
              setConfirmDelete(null)
            } catch (e) {
              setDeleteError(e instanceof Error ? e.message : String(e))
            }
          }}
        />
      )}
    </div>
  )
}
