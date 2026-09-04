import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { supabase } from '../lib/supabase'
import { useIsAdmin } from '../hooks/useIsAdmin'
import { ArrowLeft, Bug, Lightbulb, Heart, Mail, Copy, Check } from 'lucide-react'

type Kind = 'bug' | 'idea' | 'thanks'
type Status = 'new' | 'progress' | 'done'

interface Row {
  id: string
  kind: Kind
  message: string
  contact: string | null
  status: Status
  admin_reply: string | null
  archived: boolean
  user_deleted: boolean
  created_at: string
}

const STATUS_ORDER: Status[] = ['new', 'progress', 'done']

export function AdminPage({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const { lang } = useSettings()
  const ru = lang === 'ru'
  const isAdmin = useIsAdmin(user?.id)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all')
  const [replyId, setReplyId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    if (isAdmin !== true) {
      setLoading(isAdmin === null)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      const { data, error: err } = await supabase
        .from('feedback')
        .select('id, kind, message, contact, status, admin_reply, archived, user_deleted, created_at')
        .order('created_at', { ascending: false })
        .limit(100)
      if (cancelled) return
      setLoading(false)
      if (err) {
        setError(err.message)
        return
      }
      setRows((data ?? []) as Row[])
    })()
    return () => { cancelled = true }
  }, [isAdmin])

  async function setStatus(id: string, status: Status) {
    setError('')
    const prev = rows
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status } : x)))
    const { error: err } = await supabase.from('feedback').update({ status }).eq('id', id)
    if (err) {
      setRows(prev)
      setError(err.message)
    }
  }

  async function sendReply(id: string) {
    const text = replyText.trim()
    if (!text || saving) return
    setSaving(true)
    setError('')
    const { error: err } = await supabase
      .from('feedback')
      .update({ admin_reply: text.slice(0, 1000), replied_at: new Date().toISOString() })
      .eq('id', id)
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setRows((r) => r.map((x) => (x.id === id ? { ...x, admin_reply: text } : x)))
    setReplyId(null)
    setReplyText('')
  }

  /** Hard delete (админ добивает помеченное юзером) */
  async function hardDelete(id: string) {
    setConfirmDelete(null)
    setError('')
    const prev = rows
    setRows((r) => r.filter((x) => x.id !== id))
    const { error: err } = await supabase.from('feedback').delete().eq('id', id)
    if (err) {
      setRows(prev)
      setError(err.message)
    }
  }

  async function copyContact(id: string, contact: string) {
    try {
      await navigator.clipboard.writeText(contact)
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    } catch { /* clipboard недоступен */ }
  }

  if (isAdmin === null || loading) {
    return (
      <div className="py-10 text-center text-sm text-zinc-500">
        {ru ? 'Загрузка...' : 'Loading...'}
      </div>
    )
  }

  if (isAdmin === false) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900">
          <ArrowLeft className="w-4 h-4" /> {ru ? 'Назад' : 'Back'}
        </button>
        <p className="text-sm text-zinc-500 text-center py-10">
          {ru ? 'Нет доступа.' : 'Access denied.'}
        </p>
      </div>
    )
  }

  const visible = rows.filter((r) => statusFilter === 'all' || r.status === statusFilter)
  const counts: Record<string, number> = { all: rows.length }
  for (const s of STATUS_ORDER) counts[s] = rows.filter((r) => r.status === s).length

  const kindLabel = (k: Kind) =>
    k === 'bug' ? (ru ? 'Проблема' : 'Bug') : k === 'idea' ? (ru ? 'Идея' : 'Idea') : (ru ? 'Спасибо' : 'Thanks')
  const KindIcon = (k: Kind) => (k === 'bug' ? Bug : k === 'idea' ? Lightbulb : Heart)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900">
          <ArrowLeft className="w-4 h-4" /> {ru ? 'Назад' : 'Back'}
        </button>
        <h1 className="text-[18px] font-bold">{ru ? 'Обращения' : 'Feedback inbox'}</h1>
        <span className="text-xs text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-full">{rows.length}</span>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-2">
        {(['all', ...STATUS_ORDER] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`flex-1 py-2 rounded-xl border text-xs font-medium transition ${
              statusFilter === s
                ? 'border-[#7c5cff] bg-violet-50 text-[#7c5cff]'
                : 'border-zinc-200 bg-white text-zinc-600'
            }`}
          >
            {s === 'all' ? (ru ? `Все ${counts.all}` : `All ${counts.all}`) : `${s} · ${counts[s] ?? 0}`}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-zinc-500 text-center py-10">
          {ru ? 'Пока пусто.' : 'Nothing here yet.'}
        </p>
      )}

      <div className="space-y-3">
        {visible.map((r) => {
          const Icon = KindIcon(r.kind)
          const isEmail = !!r.contact && r.contact.includes('@')
          return (
            <div key={r.id} className="bg-white rounded-[20px] border border-zinc-200 p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1 text-xs font-medium text-[#7c5cff]">
                  <Icon className="w-3.5 h-3.5" /> {kindLabel(r.kind)}
                </span>
                <span className="text-[11px] text-zinc-400">
                  {new Date(r.created_at).toLocaleString(ru ? 'ru-RU' : 'en-US')}
                </span>
                <span className="ml-auto flex gap-1">
                  {STATUS_ORDER.map((s) => (
                    <button
                      key={s}
                      onClick={() => void setStatus(r.id, s)}
                      className={`text-[11px] px-2 py-1 rounded-full border transition ${
                        r.status === s
                          ? 'border-[#7c5cff] bg-violet-50 text-[#7c5cff] font-medium'
                          : 'border-zinc-200 text-zinc-400 hover:text-zinc-600'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </span>
              </div>

              <p className="text-sm text-zinc-800 whitespace-pre-wrap">{r.message}</p>

              {r.user_deleted && (
                <div className="flex items-center gap-2 flex-wrap rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                  <span className="text-xs font-medium text-amber-700">
                    {ru ? 'Юзер удалил у себя' : 'Deleted by user'}
                  </span>
                  <span className="ml-auto flex gap-2">
                    {confirmDelete === r.id ? (
                      <>
                        <button
                          onClick={() => void hardDelete(r.id)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          {ru ? 'Точно удалить?' : 'Confirm delete?'}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-xs text-zinc-500 hover:underline"
                        >
                          {ru ? 'Нет' : 'No'}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(r.id)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        {ru ? 'Удалить' : 'Delete'}
                      </button>
                    )}
                  </span>
                </div>
              )}

              {r.contact && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-xs text-zinc-400">{ru ? 'Ответить:' : 'Reply to:'}</span>
                  <code className="text-xs bg-zinc-100 rounded px-2 py-1 truncate max-w-[180px]">{r.contact}</code>
                  {isEmail ? (
                    <a
                      href={`mailto:${r.contact}`}
                      className="flex items-center gap-1 text-xs font-medium text-[#7c5cff] hover:underline"
                    >
                      <Mail className="w-3.5 h-3.5" /> Email
                    </a>
                  ) : (
                    <button
                      onClick={() => void copyContact(r.id, r.contact!)}
                      className="flex items-center gap-1 text-xs font-medium text-[#7c5cff] hover:underline"
                    >
                      {copied === r.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied === r.id ? 'OK' : (ru ? 'Копировать' : 'Copy')}
                    </button>
                  )}
                </div>
              )}

              {r.admin_reply && replyId !== r.id && (
                <p className="text-sm text-zinc-700 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 whitespace-pre-wrap">
                  {r.admin_reply}
                </p>
              )}

              {replyId === r.id ? (
                <div className="space-y-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={ru ? 'Ответ пользователю (увидит в Профиле)...' : 'Reply (user sees it in Profile)...'}
                    maxLength={1000}
                    rows={2}
                    autoFocus
                    className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#7c5cff] outline-none text-sm resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setReplyId(null); setReplyText('') }}
                      className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-sm text-zinc-600"
                    >
                      {ru ? 'Отмена' : 'Cancel'}
                    </button>
                    <button
                      onClick={() => void sendReply(r.id)}
                      disabled={saving || !replyText.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-[#7c5cff] text-white text-sm font-medium hover:bg-[#6b4de6] disabled:opacity-50 transition"
                    >
                      {ru ? 'Ответить' : 'Reply'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setReplyId(r.id); setReplyText(r.admin_reply ?? '') }}
                  className="w-full py-2.5 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
                >
                  {r.admin_reply ? (ru ? 'Изменить ответ' : 'Edit reply') : (ru ? 'Ответить в приложении' : 'Reply in app')}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
