import { useEffect, useState } from 'react'
import type { Category, Transaction, TransactionType } from '../types/transaction'
import { toLocalDateStr } from '../types/date'
import { parseAmount } from '../utils/parseAmount'
import { useSettings } from '../contexts/SettingsContext'
import { getCurrency } from '../utils/currencies'
import { localizeCategoryLabel, findCategory } from '../utils/categories'
import { t } from '../i18n'

interface Props {
  open: boolean
  onClose: () => void
  onAdd: (t: Transaction, categoryId: string | null) => void
  categories: Category[]
  onCreateCategory: (label: string, icon: string, type: Category['type']) => Promise<{ data: Category | null; error: string | null }>
}

export function AddTransactionModal({ open, onClose, onAdd, categories, onCreateCategory }: Props) {
  const { currency, lang } = useSettings()
  const curSymbol = getCurrency(currency).symbol
  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(toLocalDateStr(new Date()))
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCatLabel, setNewCatLabel] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('📦')
  const [creatingCat, setCreatingCat] = useState(false)

  useEffect(() => {
    if (open) {
      setType('expense')
      setAmount('')
      setCategory('')
      setDate(toLocalDateStr(new Date()))
      setComment('')
      setError('')
      setShowNewCat(false)
      setNewCatLabel('')
      setNewCatIcon('')
    }
  }, [open])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const filteredCategories = categories.filter((c) => c.type === type || c.type === 'both')

  function handleTypeChange(next: TransactionType) {
    setType(next)
    if (category) {
      const cat = findCategory(categories, category)
      if (cat && cat.type !== next && cat.type !== 'both') {
        setCategory('')
      }
    }
  }

  async function handleCreateCategory() {
    if (!newCatLabel.trim()) {
      setError(lang==='ru'?'Введите название категории':'Enter category name')
      return
    }
    setCreatingCat(true)
    setError('')
    const { data, error: err } = await onCreateCategory(newCatLabel.trim(), newCatIcon.trim() || '📦', type)
    setCreatingCat(false)
    if (err) {
      if (err.includes('PGRST205') || err.includes('schema cache')) {
        setError(lang==='ru'?'Таблицы ещё нет. Выполни supabase/schema.sql в Supabase SQL Editor и обнови страницу.':'Tables missing. Run supabase/schema.sql in SQL Editor and reload.')
      } else {
        setError(err)
      }
      return
    }
    if (data) {
      setCategory(data.id)
      setShowNewCat(false)
      setNewCatLabel('')
      setNewCatIcon('')
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const num = parseAmount(amount)
    if (num === null) {
      setError(lang==='ru'?'Введите корректную сумму больше 0':'Enter valid amount > 0')
      return
    }
    if (!category) {
      setError(t(lang,'chooseCategory'))
      return
    }
    if (!date) {
      setError(t(lang,'date'))
      return
    }
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(category)
    const transaction: Transaction = {
      id: Date.now().toString(),
      type,
      amount: num,
      category,
      date,
      comment: comment.trim() || undefined,
    }
    onAdd(transaction, isUuid ? category : null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white w-full lg:max-w-[480px] rounded-t-[20px] lg:rounded-[20px] shadow-xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-[18px] font-semibold">{t(lang,'newOp')}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 hover:bg-zinc-200">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-auto px-6 py-5 space-y-5">
          <div className="flex gap-3">
            <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 cursor-pointer transition-colors ${type === 'expense' ? 'border-[#7c5cff] bg-[#f1efff] text-[#7c5cff]' : 'border-zinc-200 bg-white text-zinc-600'}`}>
              <input type="radio" name="type" value="expense" checked={type === 'expense'} onChange={() => handleTypeChange('expense')} className="sr-only" />
              <span className="text-sm font-medium">{t(lang,'expense')}</span><span>💸</span>
            </label>
            <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 cursor-pointer transition-colors ${type === 'income' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-white text-zinc-600'}`}>
              <input type="radio" name="type" value="income" checked={type === 'income'} onChange={() => handleTypeChange('income')} className="sr-only" />
              <span className="text-sm font-medium">{t(lang,'income')}</span><span>💰</span>
            </label>
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1.5">{t(lang,'amount')} ({curSymbol})</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">{curSymbol}</span>
              <input type="text" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full pl-8 pr-3 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#7c5cff] focus:ring-4 focus:ring-violet-100 outline-none transition text-[16px]" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1.5">{t(lang,'category')}</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#7c5cff] focus:ring-4 focus:ring-violet-100 outline-none transition text-[15px]">
              <option value="">{t(lang,'chooseCategory')}</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {localizeCategoryLabel(c, lang)}</option>
              ))}
            </select>
            {!showNewCat ? (
              <button type="button" onClick={() => setShowNewCat(true)} className="text-xs text-[#7c5cff] mt-2 hover:underline">＋ {t(lang,'createCategory')}</button>
            ) : (
              <div className="mt-3 p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
                <p className="text-xs font-medium text-zinc-700">{t(lang,'newCategoryFor')} ({type === 'expense' ? t(lang,'expense').toLowerCase() : t(lang,'income').toLowerCase()})</p>
                <input type="text" placeholder={lang==='ru'?'Название (например: Кот)':'Name (e.g. Cat)'} value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-[15px] outline-none focus:border-[#7c5cff]" />
                <div>
                  <p className="text-xs text-zinc-500 mb-1">{t(lang,'icon')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['🍔','🚆','🛍️','🏠','🎬','💊','💰','💻','📦','🐱','🐶','🎮','✈️','☕','🍕','💡','🎁','🚗','🏥','📚','🎵','💄','👶','🐾','⚽','🎨','🍎','💳'].map(em=>(
                      <button key={em} type="button" onClick={()=>setNewCatIcon(em)} className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg border ${newCatIcon===em?'border-[#7c5cff] bg-[#f1efff]':'border-zinc-200 bg-white hover:bg-zinc-50'}`}>{em}</button>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <span className="text-xs text-zinc-500 py-2">{t(lang,'orOwn')}</span>
                    <input type="text" placeholder="📦" value={newCatIcon} onChange={(e)=>setNewCatIcon(e.target.value)} className="w-14 px-2 py-1.5 rounded-lg border border-zinc-200 bg-white text-center outline-none focus:border-[#7c5cff]" maxLength={2} />
                    {newCatIcon && <span className="w-8 h-8 rounded-lg border border-zinc-200 bg-white flex items-center justify-center text-lg">{newCatIcon}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={handleCreateCategory} disabled={creatingCat} className="flex-1 py-2 rounded-lg bg-[#7c5cff] text-white text-sm font-medium disabled:opacity-60">{creatingCat ? t(lang,'creating') : t(lang,'createAndSelect')}</button>
                  <button type="button" onClick={() => setShowNewCat(false)} className="flex-1 py-2 rounded-lg border border-zinc-200 bg-white text-sm">{t(lang,'cancel')}</button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1.5">{t(lang,'date')}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#7c5cff] focus:ring-4 focus:ring-violet-100 outline-none transition text-[15px]" />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1.5">{t(lang,'comment')}</label>
            <input type="text" placeholder={lang==='ru'?'Например: обед с коллегами':'e.g. lunch with colleagues'} value={comment} onChange={(e) => setComment(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#7c5cff] focus:ring-4 focus:ring-violet-100 outline-none transition text-[15px]" />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </form>

        <div className="p-6 pt-4 border-t border-zinc-100 flex gap-3 bg-white">
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-zinc-200 bg-white font-medium hover:bg-zinc-50 transition">{t(lang,'cancel')}</button>
          <button onClick={handleSubmit} className="flex-1 py-3 rounded-xl bg-[#7c5cff] hover:bg-[#6b4de6] text-white font-medium transition">{t(lang,'add')}</button>
        </div>
      </div>
    </div>
  )
}
