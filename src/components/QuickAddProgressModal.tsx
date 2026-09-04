import { useEffect, useState } from 'react'
import { useSettings } from '../contexts/SettingsContext'
import { getCurrency } from '../utils/currencies'
import { parseAmount } from '../utils/parseAmount'
import { t } from '../i18n'

interface Props {
  open: boolean
  onClose: () => void
  goalName: string
  goalIcon: string
  goalSaved: number
  goalTarget: number
  onAdd: (amount: number) => Promise<{ error: string | null }>
}

export function QuickAddProgressModal({ open, onClose, goalName, goalIcon, goalSaved, goalTarget, onAdd }: Props) {
  const { currency, lang } = useSettings()
  const curSymbol = getCurrency(currency).symbol
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (open) {
      setAmount('')
      setError('')
    }
  }, [open])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const remaining = Math.max(0, goalTarget - goalSaved)
  const quickAmounts = [100, 500, 1000, 5000]
  const isDisabled = goalTarget <= 0 || remaining <= 0

  async function handleAdd() {
    if (isDisabled) return
    const num = parseAmount(amount)
    if (num === null) {
      setError(lang === 'ru' ? 'Введите корректную сумму' : 'Enter valid amount')
      return
    }
    setAdding(true)
    setError('')
    const result = await onAdd(num)
    setAdding(false)
    if (result.error) {
      setError(result.error)
    } else {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full lg:max-w-[400px] rounded-t-[20px] lg:rounded-[20px] shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-zinc-100 flex items-center gap-3">
          <span className="text-2xl">{goalIcon}</span>
          <div>
            <h2 className="text-[16px] font-semibold">{t(lang, 'goalAddProgressTitle')}</h2>
            <p className="text-xs text-zinc-500">{goalName}</p>
          </div>
          <button onClick={onClose} className="ml-auto w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 hover:bg-zinc-200">✕</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Current progress */}
          <div className="bg-zinc-50 rounded-xl p-3 text-center">
            <p className="text-xs text-zinc-500">{t(lang, 'goalSaved')}</p>
            <p className="text-lg font-semibold">{goalSaved.toLocaleString('ru-RU')} {curSymbol}</p>
            <p className="text-xs text-zinc-400">{t(lang, 'goalRemaining')}: {remaining.toLocaleString('ru-RU')} {curSymbol}</p>
          </div>

          {/* Quick amounts */}
          <div>
            <p className="text-xs text-zinc-500 mb-2">{lang === 'ru' ? 'Быстрые суммы:' : 'Quick amounts:'}</p>
            <div className="flex gap-2">
              {quickAmounts.map((qa) => (
                <button
                  key={qa}
                  type="button"
                  onClick={() => setAmount(qa.toString())}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${amount === qa.toString() ? 'border-[#7c5cff] bg-[#f1efff] text-[#7c5cff]' : 'border-zinc-200 bg-white hover:bg-zinc-50'}`}
                >{qa}{curSymbol}</button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1.5">{t(lang, 'goalProgressAmount')} ({curSymbol})</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">{curSymbol}</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                max={remaining}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-3 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#7c5cff] focus:ring-4 focus:ring-violet-100 outline-none transition text-[16px]"
              />
            </div>
            <p className="text-xs text-zinc-400 mt-1.5">{lang === 'ru' ? `Осталось до цели: ${remaining.toLocaleString('ru-RU')} ${curSymbol}. Лишнее обрежется до цели.` : `Remaining: ${remaining.toLocaleString('en-US')} ${curSymbol}. Excess will be trimmed to the goal.`}</p>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          {isDisabled && <p className="text-sm text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">{lang === 'ru' ? 'Цель уже выполнена или сумма цели некорректна' : 'Goal is already complete or target is invalid'}</p>}
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-zinc-100 bg-white">
          <button
            onClick={handleAdd}
            disabled={adding || isDisabled}
            className="w-full py-3 rounded-xl bg-[#7c5cff] hover:bg-[#6b4de6] text-white font-medium transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {adding ? (lang === 'ru' ? 'Добавление...' : 'Adding...') : t(lang, 'goalAddProgress')}
          </button>
        </div>
      </div>
    </div>
  )
}
