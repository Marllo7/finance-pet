import { useMemo, useState } from 'react'
import type { Category, Transaction } from '../types/transaction'
import { useSettings } from '../contexts/SettingsContext'
import { formatMoney, formatMoneyWithSign } from '../utils/currencies'
import { localizeCategoryLabel } from '../utils/categories'
import { t } from '../i18n'
import { formatDateRelative } from '../utils/formatDate'
import { filterTransactionsByPeriod, calculatePeriodBalance } from '../types/date'
import { CompactPeriodSelector } from '../components/CompactPeriodSelector'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { Search, Filter, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react'
import type { PeriodOption, DateRange } from '../types/date'
import { getCategoryIcon, getCategoryLabel } from '../utils/categories'

const COLORS = ['#7c5cff','#22c55e','#f59e0b','#ef4444','#06b6d4','#ec4899','#6366f1','#14b8a6','#f97316','#8b5cf6']

export function TransactionsStatsPage({
  transactions,
  categories,
  onDelete,
  onEdit,
}: {
  transactions: Transaction[]
  categories: Category[]
  onDelete?: (id: string) => void
  onEdit?: (t: Transaction) => void
}) {
  const { currency, lang } = useSettings()
  const [showFilters, setShowFilters] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [catFilter, setCatFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [period, setPeriod] = useState<PeriodOption>('month')
  const [dateRange, setDateRange] = useState<DateRange | null>(null)

  // Period-based stats
  const filteredByPeriod = useMemo(
    () => filterTransactionsByPeriod(transactions, period, dateRange),
    [transactions, period, dateRange]
  )
  const { income: periodIncome, expense: periodExpense, balance: periodBalance } = calculatePeriodBalance(
    filteredByPeriod,
    period,
    dateRange
  )

  // Search/filter — применяется поверх фильтра периода
  const filtered = useMemo(() => {
    return [...filteredByPeriod]
      .filter((t) => {
        if (typeFilter !== 'all' && t.type !== typeFilter) return false
        if (catFilter !== 'all' && t.category !== catFilter) return false
        if (dateFrom && t.date < dateFrom) return false
        if (dateTo && t.date > dateTo) return false
        if (search) {
          const q = search.toLowerCase()
          const cat = categories.find((c) => c.id === t.category)
          const label = cat ? localizeCategoryLabel(cat, lang) : t.category
          const comment = (t.comment ?? '').toLowerCase()
          if (!label.toLowerCase().includes(q) && !comment.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [filteredByPeriod, search, typeFilter, catFilter, dateFrom, dateTo, categories, lang])

  // Chart data — расходы по категориям за выбранный период
  const expenseByCat = useMemo(() => {
    const map = new Map<string, number>()
    filteredByPeriod
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const cat = categories.find((c) => c.id === t.category)
        const label = cat ? localizeCategoryLabel(cat, lang) : t.category
        map.set(label, (map.get(label) ?? 0) + t.amount)
      })
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [filteredByPeriod, categories, lang])

  const monthly = useMemo(() => {
    const map = new Map<string, { month: string; income: number; expense: number }>()
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { month: 'short' })
      map.set(key, { month: label, income: 0, expense: 0 })
    }
    transactions.forEach((t) => {
      const key = t.date.slice(0, 7)
      if (map.has(key)) {
        const entry = map.get(key)!
        if (t.type === 'income') entry.income += t.amount
        else entry.expense += t.amount
      }
    })
    return Array.from(map.values())
  }, [transactions, lang])

  function hasActiveFilters() {
    return search || typeFilter !== 'all' || catFilter !== 'all' || dateFrom || dateTo
  }

  function resetFilters() {
    setSearch('')
    setTypeFilter('all')
    setCatFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold">{t(lang, 'transactions')}</h1>
          <p className="text-sm text-zinc-500">{t(lang, 'transactionsSub')}</p>
        </div>
        <CompactPeriodSelector
          value={period}
          onChange={setPeriod}
          onRangeChange={setDateRange}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-white rounded-xl sm:rounded-2xl border border-zinc-200 p-3 sm:p-4 shadow-sm">
          <p className="text-[10px] text-zinc-500 mb-0.5 sm:mb-1">{t(lang, 'balance')}</p>
          <p className={`text-base sm:text-xl font-bold ${periodBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatMoney(periodBalance, currency)}
          </p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl border border-zinc-200 p-3 sm:p-4 shadow-sm">
          <p className="text-[10px] text-zinc-500 mb-0.5 sm:mb-1">{t(lang, 'income')}</p>
          <p className="text-base sm:text-xl font-bold text-emerald-600">{formatMoney(periodIncome, currency)}</p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl border border-zinc-200 p-3 sm:p-4 shadow-sm">
          <p className="text-[10px] text-zinc-500 mb-0.5 sm:mb-1">{t(lang, 'expense')}</p>
          <p className="text-base sm:text-xl font-bold">{formatMoney(periodExpense, currency)}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-[20px] border border-zinc-200 p-4 sm:p-6 shadow-sm">
          <h3 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">{t(lang, 'expensesByCat')}</h3>
          {expenseByCat.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-8">{t(lang, 'noExpenses')}</p>
          ) : (
            <div className="h-[200px] sm:h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseByCat}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {expenseByCat.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatMoney(Number(v), currency)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-[20px] border border-zinc-200 p-4 sm:p-6 shadow-sm">
          <h3 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">{t(lang, 'monthlyTrend')}</h3>
          <div className="h-[200px] sm:h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => String(v)} />
                <Tooltip formatter={(v: any) => formatMoney(Number(v), currency)} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="income" name={t(lang, 'income')} fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name={t(lang, 'expense')} fill="#7c5cff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-[20px] border border-zinc-200 shadow-sm overflow-hidden">
        {/* Filters toggle */}
        <div className="p-4 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder={t(lang, 'searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#7c5cff] outline-none text-sm"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2.5 rounded-xl border border-zinc-200 flex items-center gap-2 text-sm font-medium transition ${
                showFilters ? 'bg-[#7c5cff] text-white border-[#7c5cff]' : 'bg-zinc-50 hover:bg-zinc-100'
              }`}
            >
              <Filter className="w-4 h-4" />
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="px-3 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-sm"
              >
                <option value="all">{t(lang, 'allTypes')}</option>
                <option value="expense">{t(lang, 'expense')}</option>
                <option value="income">{t(lang, 'income')}</option>
              </select>
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-sm"
              >
                <option value="all">{t(lang, 'allCategories')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {localizeCategoryLabel(c, lang)}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-sm"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-sm"
              />
            </div>
          )}

          {hasActiveFilters() && (
            <button onClick={resetFilters} className="mt-2 text-xs text-[#7c5cff] hover:underline">
              {t(lang, 'resetFilters')}
            </button>
          )}
        </div>

        {/* Transactions list */}
        <div className="divide-y divide-zinc-100">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-sm">{t(lang, 'nothingFound')}</div>
          ) : (
            <>
              <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-100 text-xs text-zinc-500">
                {filtered.length} {t(lang, 'foundOf')} {transactions.length}
              </div>
              {filtered.map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-4 hover:bg-zinc-50 group">
                  <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-center text-lg">
                    {getCategoryIcon(categories, t)}
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit?.(t)}>
                    <p className="text-sm font-medium">{getCategoryLabel(categories, t, lang)}</p>
                    <p className="text-xs text-zinc-500">
                      {formatDateRelative(t.date, lang)}
                    </p>
                  </div>
                  <p className={`text-sm font-semibold ${t.type === 'income' ? 'text-emerald-600' : 'text-zinc-900'}`}>
                    {formatMoneyWithSign(t.amount, t.type, currency)}
                  </p>
                  <div className="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => onEdit?.(t)}
                      className="w-8 h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition"
                    >
                      <Pencil className="w-3.5 h-3.5 text-zinc-600" />
                    </button>
                    {onDelete && (
                      <button
                        onClick={() => onDelete(t.id)}
                        className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
