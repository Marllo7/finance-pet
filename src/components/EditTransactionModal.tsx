import { useEffect, useState } from 'react'
import type { Category, Transaction, TransactionType } from '../types/transaction'
import { useSettings } from '../contexts/SettingsContext'
import { getCurrency } from '../utils/currencies'
import { findCategory, localizeCategoryLabel } from '../utils/categories'
import { parseAmount } from '../utils/parseAmount'
import { ConfirmModal } from './ConfirmModal'
import { t } from '../i18n'

interface Props {
  open: boolean
  transaction: Transaction | null
  categories: Category[]
  onClose: () => void
  onSave: (id: string, patch: Partial<Transaction>, categoryId: string | null) => Promise<{ error: string | null }>
  onDelete: (id: string) => void
}

export function EditTransactionModal({ open, transaction, categories, onClose, onSave, onDelete }: Props) {
  const { currency, lang } = useSettings()
  const curSymbol = getCurrency(currency).symbol
  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  useEffect(()=>{
    if(open && transaction){
      setType(transaction.type)
      setAmount(String(transaction.amount))
      setCategory(transaction.category)
      setDate(transaction.date)
      setComment(transaction.comment ?? '')
      setError('')
    }
  },[open, transaction])

  useEffect(()=>{
    if(open) document.body.style.overflow='hidden'
    else document.body.style.overflow=''
    return ()=>{ document.body.style.overflow='' }
  },[open])

  if(!open || !transaction) return null

  const filteredCategories = categories.filter(c=> c.type===type || c.type==='both')

  function handleTypeChange(next: TransactionType) {
    setType(next)
    if (category) {
      const cat = findCategory(categories, category)
      if (cat && cat.type !== next && cat.type !== 'both') {
        setCategory('')
      }
    }
  }

  async function handleSave(e: React.FormEvent){
    e.preventDefault()
    const num = parseAmount(amount)
    if (num === null) { setError(lang==='ru'?'Введите корректную сумму':'Enter valid amount'); return }
    if(!category){ setError(t(lang,'chooseCategory')); return }
    if(!date){ setError(t(lang,'date')); return }
    if(!transaction) return
    setSaving(true)
    setError('')
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(category)
    const { error: err } = await onSave(transaction.id, { type, amount: num, category, date, comment: comment.trim() || undefined }, isUuid? category: null)
    setSaving(false)
    if(err){ setError(err); return }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full lg:max-w-[480px] rounded-t-[20px] lg:rounded-[20px] shadow-xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-[18px] font-semibold">{t(lang,'edit')}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">✕</button>
        </div>
        <form onSubmit={handleSave} className="flex-1 overflow-auto px-6 py-5 space-y-5">
          <div className="flex gap-3">
            <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 cursor-pointer ${type==='expense'?'border-[#7c5cff] bg-[#f1efff] text-[#7c5cff]':'border-zinc-200'}`}>
              <input type="radio" checked={type==='expense'} onChange={()=>handleTypeChange('expense')} className="sr-only"/>{t(lang,'expense')} 💸
            </label>
            <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 cursor-pointer ${type==='income'?'border-emerald-500 bg-emerald-50 text-emerald-700':'border-zinc-200'}`}>
              <input type="radio" checked={type==='income'} onChange={()=>handleTypeChange('income')} className="sr-only"/>{t(lang,'income')} 💰
            </label>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">{t(lang,'amount')} ({curSymbol})</label>
            <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">{curSymbol}</span>
              <input type="text" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full pl-8 pr-3 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#7c5cff] outline-none" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">{t(lang,'category')}</label>
            <select value={category} onChange={e=>setCategory(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-zinc-200 bg-zinc-50">
              <option value="">{t(lang,'chooseCategory')}</option>
              {filteredCategories.map(c=> <option key={c.id} value={c.id}>{c.icon} {localizeCategoryLabel(c, lang)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">{t(lang,'date')}</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-zinc-200 bg-zinc-50" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">{t(lang,'comment')}</label>
            <input type="text" value={comment} onChange={e=>setComment(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-zinc-200 bg-zinc-50" />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </form>
        <div className="p-6 pt-4 border-t border-zinc-100 flex gap-3">
          <button onClick={()=> setShowConfirmDelete(true)} className="px-4 py-3 rounded-xl border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition">{t(lang,'delete')}</button>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-zinc-200 bg-white">{t(lang,'cancel')}</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl bg-[#7c5cff] text-white disabled:opacity-60">{saving? t(lang,'saving'): t(lang,'save')}</button>
        </div>
      </div>
      <ConfirmModal
        open={showConfirmDelete}
        title={lang === 'ru' ? 'Удалить операцию?' : 'Delete transaction?'}
        description={lang === 'ru' ? 'Это действие нельзя отменить.' : 'This action cannot be undone.'}
        confirmLabel={t(lang, 'delete')}
        cancelLabel={t(lang, 'cancel')}
        onCancel={() => setShowConfirmDelete(false)}
        onConfirm={() => {
          if (!transaction) return
          onDelete(transaction.id)
          setShowConfirmDelete(false)
          onClose()
        }}
      />
    </div>
  )
}
