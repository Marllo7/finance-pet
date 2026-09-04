import { useEffect, useState } from 'react'
import type { Goal } from '../types/transaction'
import { useSettings } from '../contexts/SettingsContext'
import { getCurrency } from '../utils/currencies'
import { parseAmount } from '../utils/parseAmount'
import { t } from '../i18n'
import { ConfirmModal } from './ConfirmModal'
import { X, Trash2, CalendarX } from 'lucide-react'

const GOAL_ICONS = ['🎯','📱','✈️','🎮','💍','🚗','🏠','📚','🎸','🐾','🎁','💻','📷','🎧','👟','🧳','🏖️','🎪','🐕','🌍','🎹','🧲','💎','🏆']
const GOAL_COLORS = ['#7c5cff','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#8b5cf6','#14b8a6','#f97316','#6366f1']

interface Props {
  open: boolean
  onClose: () => void
  onSave: (g: Omit<Goal, 'id' | 'createdAt'>) => Promise<{ error: string | null }>
  initial?: Goal | null
  onDelete?: () => void
}

export function AddGoalModal({ open, onClose, onSave, initial, onDelete }: Props) {
  const { currency, lang } = useSettings()
  const curSymbol = getCurrency(currency).symbol
  const isEdit = !!initial

  const [name, setName] = useState('')
  const [icon, setIcon] = useState('🎯')
  const [targetAmount, setTargetAmount] = useState('')
  const [savedAmount, setSavedAmount] = useState('')
  const [deadline, setDeadline] = useState('')
  const [color, setColor] = useState('#7c5cff')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  useEffect(() => {
    if (open) {
      if (initial) {
        setName(initial.name)
        setIcon(initial.icon)
        setTargetAmount(initial.targetAmount.toString())
        setSavedAmount(initial.savedAmount.toString())
        setDeadline(initial.deadline ?? '')
        setColor(initial.color ?? '#7c5cff')
      } else {
        setName('')
        setIcon('🎯')
        setTargetAmount('')
        setSavedAmount('')
        setDeadline('')
        setColor('#7c5cff')
      }
      setError('')
    }
  }, [open, initial])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  function clearDeadline() {
    setDeadline('')
  }

  async function handleSave() {
    const target = parseAmount(targetAmount)
    const savedRaw = savedAmount.trim()
    let saved: number | null = 0
    if (savedRaw !== '') {
      const parsed = parseAmount(savedRaw)
      if (parsed !== null) {
        saved = parsed
      } else {
        // parseAmount отклоняет 0, но для накоплений 0 валиден
        const zeroCheck = Number(savedRaw.replace(',', '.'))
        saved = zeroCheck === 0 ? 0 : null
      }
    }

    if (!name.trim()) {
      setError(lang === 'ru' ? 'Введите название цели' : 'Enter goal name')
      return
    }
    if (target === null) {
      setError(lang === 'ru' ? 'Введите корректную сумму цели больше 0' : 'Enter valid target amount > 0')
      return
    }
    if (saved === null || saved < 0 || saved > target) {
      setError(lang === 'ru' ? 'Накопленная сумма должна быть от 0 до суммы цели' : 'Saved amount must be between 0 and target')
      return
    }

    setSaving(true)
    setError('')
    const result = await onSave({
      name: name.trim(),
      icon,
      targetAmount: target,
      savedAmount: saved,
      deadline: deadline || undefined,
      color,
    })
    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full lg:max-w-[480px] rounded-t-[20px] lg:rounded-[20px] shadow-xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-[18px] font-semibold">{isEdit ? t(lang, 'goalEdit') : t(lang, 'newGoal')}</h2>
          <div className="flex items-center gap-2">
            {isEdit && onDelete && (
              <button onClick={() => setShowConfirmDelete(true)} className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition">
              <X className="w-4 h-4 text-zinc-500" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={(e) => { e.preventDefault(); handleSave() }} className="flex-1 overflow-auto px-6 py-5 space-y-5">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1.5">{t(lang, 'goalName')}</label>
            <input
              type="text"
              placeholder={t(lang, 'goalNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#7c5cff] focus:ring-4 focus:ring-violet-100 outline-none transition text-[15px]"
            />
          </div>

          {/* Icon */}
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1.5">{t(lang, 'goalIcon')}</label>
            <div className="flex flex-wrap gap-1.5">
              {GOAL_ICONS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setIcon(em)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg border transition ${icon === em ? 'border-[#7c5cff] bg-[#f1efff] scale-110' : 'border-zinc-200 bg-white hover:bg-zinc-50'}`}
                >{em}</button>
              ))}
            </div>
          </div>

          {/* Target amount */}
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1.5">{t(lang, 'goalTarget')}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">{curSymbol}</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder={t(lang, 'goalTargetPlaceholder')}
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="w-full pl-8 pr-3 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#7c5cff] focus:ring-4 focus:ring-violet-100 outline-none transition text-[16px]"
              />
            </div>
          </div>

          {/* Saved amount */}
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1.5">{t(lang, 'goalSaved')}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">{curSymbol}</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder={t(lang, 'goalSavedPlaceholder')}
                value={savedAmount}
                onChange={(e) => setSavedAmount(e.target.value)}
                className="w-full pl-8 pr-3 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#7c5cff] focus:ring-4 focus:ring-violet-100 outline-none transition text-[16px]"
              />
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1.5">{t(lang, 'goalDeadline')}</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="flex-1 px-3 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#7c5cff] focus:ring-4 focus:ring-violet-100 outline-none transition text-[15px]"
              />
              {deadline && (
                <button
                  type="button"
                  onClick={clearDeadline}
                  className="px-3 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-500 transition flex items-center gap-1"
                  title={lang === 'ru' ? 'Очистить дату' : 'Clear date'}
                >
                  <CalendarX className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1.5">{t(lang, 'goalColor')}</label>
            <div className="flex flex-wrap gap-2">
              {GOAL_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition ${color === c ? 'ring-2 ring-offset-2 ring-zinc-400 scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </form>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-zinc-100 flex gap-3 bg-white">
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-zinc-200 bg-white font-medium hover:bg-zinc-50 transition">{t(lang, 'cancel')}</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl bg-[#7c5cff] hover:bg-[#6b4de6] text-white font-medium transition disabled:opacity-60">
            {saving ? (lang === 'ru' ? 'Сохранение...' : 'Saving...') : (isEdit ? t(lang, 'save') : t(lang, 'add'))}
          </button>
        </div>
      </div>
      <ConfirmModal
        open={showConfirmDelete}
        title={lang === 'ru' ? 'Удалить цель?' : 'Delete goal?'}
        description={lang === 'ru' ? 'Это действие нельзя отменить.' : 'This action cannot be undone.'}
        confirmLabel={t(lang, 'delete')}
        cancelLabel={t(lang, 'cancel')}
        onCancel={() => setShowConfirmDelete(false)}
        onConfirm={() => {
          setShowConfirmDelete(false)
          onDelete?.()
        }}
      />
    </div>
  )
}
