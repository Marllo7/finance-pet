import type { Category, Goal, Transaction } from '../types/transaction'
import { useSettings } from '../contexts/SettingsContext'
import { formatMoney, formatMoneyWithSign } from '../utils/currencies'
import { getCategoryIcon, getCategoryLabel } from '../utils/categories'
import { calculatePetStats } from '../utils/pet'
import { t } from '../i18n'
import { TrendingUp, TrendingDown, Pencil, Cat, Flame, Sparkles } from 'lucide-react'
import { CompactPeriodSelector } from '../components/CompactPeriodSelector'
import { filterTransactionsByPeriod, calculatePeriodBalance } from '../types/date'
import { useState } from 'react'
import type { PeriodOption, DateRange } from '../types/date'
import { formatDateRelative } from '../utils/formatDate'
import { capitalize } from '../utils/capitalize'
import { calcDailyStats, calcStreak, moodReason, pickInsight } from '../utils/petInsights'

interface Props {
  transactions: Transaction[]
  categories: Category[]
  goals?: Goal[]
  petName?: string | null
  onEdit?: (t: Transaction) => void
}

export function Dashboard({ transactions, categories, goals, petName, onEdit }: Props) {
  const { currency, lang } = useSettings()
  const [period, setPeriod] = useState<PeriodOption>('month')
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  
  // Filter transactions by selected period
  const filteredTransactions = filterTransactionsByPeriod(transactions, period, dateRange)
  const { income, expense, balance } = calculatePeriodBalance(filteredTransactions, period, dateRange)

  const balanceFormatted = formatMoney(balance, currency)
  const incomeFormatted = formatMoney(income, currency)
  const expenseFormatted = formatMoney(expense, currency)

  // Пустой период — показываем заглушку с нулевым балансом
  const isEmptyPeriod = filteredTransactions.length === 0

  // Геймификация питомца: считаем от ВСЕХ операций (transactions), а не от
  // filteredTransactions — уровень долгосрочный и не должен падать при смене периода.
  const petStats = calculatePetStats(transactions, goals ?? [])

  // Живой статус дня: стрик, цифры, инсайт (пересчитывается каждый рендер).
  // Уровни скрыты по решению: на данном этапе они ничего не дают.
  const streak = calcStreak(transactions)
  const daily = calcDailyStats(transactions, goals ?? [])
  const insightKey = pickInsight(daily, streak, transactions.length, goals?.length ?? 0)
  const insightText = (() => {
    const ru = lang === 'ru'
    switch (insightKey) {
      case 'empty':
        return ru ? 'Я пока ничего не знаю — добавь первую трату или спроси меня в чате' : 'I know nothing yet — add your first expense or ask me in chat'
      case 'miss':
        return ru ? `Давно не виделись — ${daily.daysSilent} дн. без записей. Покажи хоть один чек?` : `Long time no see — ${daily.daysSilent}d silent. Show me a receipt?`
      case 'topcat':
        return ru
          ? `«${daily.topCategory!.category}» съедает ${Math.round(daily.topCategory!.share * 100)}% недели — спроси в чате, как ужать`
          : `“${daily.topCategory!.category}” takes ${Math.round(daily.topCategory!.share * 100)}% of the week — ask chat how to trim`
      case 'goal':
        return ru
          ? `До «${daily.closestGoal!.name}» осталось ${formatMoney(daily.closestGoal!.remaining, currency)} (${daily.closestGoal!.pct}%) — дожмём?`
          : `“${daily.closestGoal!.name}” needs ${formatMoney(daily.closestGoal!.remaining, currency)} (${daily.closestGoal!.pct}%) — push it?`
      case 'overspend':
        return ru ? 'На этой неделе траты выше доходов — давай разберём в чате' : 'Spending above income this week — let’s review in chat'
      case 'streak':
        return ru ? `Серия ${streak} дн. подряд — так держать! Не прерви сегодня` : `${streak}-day streak — keep it going!`
      case 'plan':
        return ru ? 'Утро — лучшее время для плана: спроси в чате лимит на сегодня' : 'Morning is for planning — ask chat for today’s limit'
      case 'summary':
        return ru ? 'Вечер — подведём итог дня в чате одной фразой' : 'Evening — let’s sum up the day in chat'
      default:
        return ru ? 'Всё спокойно. Заглядывай в чат за советами' : 'All calm. Check chat for tips'
    }
  })()

  return (
    <div className="space-y-5">
      <div data-tour="balance" className="bg-white rounded-[20px] border border-zinc-200 p-4 sm:p-6 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm text-zinc-500 mb-1">{t(lang,'balance')}</p>
            <p className="text-[28px] sm:text-[32px] font-bold tracking-tight">{balanceFormatted}</p>
            {isEmptyPeriod && (
              <p className="text-xs text-zinc-400 mt-1">
                {lang === 'ru' ? 'Нет операций за выбранный период' : 'No transactions in this period'}
              </p>
            )}
          </div>
          <CompactPeriodSelector
            value={period}
            onChange={setPeriod}
            onRangeChange={setDateRange}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="bg-emerald-50 rounded-2xl p-3 sm:p-4 border border-emerald-100">
            <p className="text-[10px] sm:text-xs font-medium text-emerald-700 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> {t(lang,'income')}
            </p>
            <p className="text-[15px] sm:text-[18px] font-semibold text-emerald-800 mt-0.5">{incomeFormatted}</p>
          </div>
          <div className="bg-zinc-50 rounded-2xl p-3 sm:p-4 border border-zinc-200">
            <p className="text-[10px] sm:text-xs font-medium text-zinc-600 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> {t(lang,'expense')}
            </p>
            <p className="text-[15px] sm:text-[18px] font-semibold text-zinc-900 mt-0.5">{expenseFormatted}</p>
          </div>
        </div>
      </div>

      {/* Pet status card — живой статус дня (некликабельная, чат — отдельная иконка) */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 items-start">
        {/* Pet status card — звание, настроение с причиной, цифры дня, инсайт */}
        <div data-tour="pet" className="bg-gradient-to-br from-[#7c5cff] to-[#9d7cff] rounded-[20px] p-5 text-white shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shrink-0">
              <Cat className="w-8 h-8 text-[#7c5cff]" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-[15px] truncate">{capitalize(petName ?? '') || (lang === 'ru' ? 'Питомец' : 'Pet')}</p>
              <p className="text-xs text-white/80 truncate">
                {moodReason(petStats.moodPct, daily, streak, lang)}
              </p>
            </div>
            {streak >= 2 && (
              <span className="ml-auto flex items-center gap-1 text-xs font-semibold bg-white/20 rounded-full px-2.5 py-1 shrink-0">
                <Flame className="w-3.5 h-3.5" /> {streak}
              </span>
            )}
          </div>
          {/* Цифры дня */}
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div className="bg-white/15 rounded-xl px-2 py-2">
              <p className="text-[10px] uppercase tracking-wide text-white/70">{lang === 'ru' ? 'Сегодня' : 'Today'}</p>
              <p className="text-sm font-semibold">{formatMoney(daily.todayExpense, currency)}</p>
            </div>
            <div className="bg-white/15 rounded-xl px-2 py-2">
              <p className="text-[10px] uppercase tracking-wide text-white/70">{lang === 'ru' ? 'Неделя' : 'Week'}</p>
              <p className="text-sm font-semibold">{formatMoney(daily.weekExpense, currency)}</p>
            </div>
          </div>
          {daily.safePerDay !== null && (
            <p className="mt-2 text-xs text-white/85">
              {lang === 'ru'
                ? `Можно тратить ~${formatMoney(daily.safePerDay, currency)}/день до конца месяца`
                : `Safe to spend ~${formatMoney(daily.safePerDay, currency)}/day`}
            </p>
          )}
          {/* Инсайт дня */}
          <p className="mt-2 text-[13px] leading-snug bg-white/15 rounded-xl px-3 py-2 flex items-start gap-1.5">
            <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{insightText}</span>
          </p>
        </div>

        {/* Chat widget — floating button on all pages */}
        {/* Note: ChatWidget renders as fixed-position widget, not inline */}
        <div className="hidden" />
      </div>

      {/* Goals widget */}
      {goals && goals.length > 0 && (
        <div data-tour="goals" className="bg-white rounded-[20px] border border-zinc-200 p-6 shadow-sm">
          <h3 className="font-semibold mb-4">{t(lang, 'goalActiveGoals')}</h3>
          <div className="space-y-3">
            {goals.slice(0, 3).map((g) => {
              // Кламп снизу: отрицательный savedAmount не должен давать отрицательный прогресс/ширину.
              const progress = g.targetAmount > 0 ? Math.max(0, Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100))) : 0
              const remaining = Math.max(0, g.targetAmount - g.savedAmount)
              return (
                <div key={g.id} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor: `${g.color ?? '#7c5cff'}15` }}
                  >
                    {g.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium truncate">{g.name}</p>
                      <p className="text-xs font-semibold ml-2" style={{ color: g.color ?? '#7c5cff' }}>{progress}%</p>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${progress}%`, backgroundColor: g.color ?? '#7c5cff' }}
                      />
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {formatMoney(g.savedAmount, currency)} / {formatMoney(g.targetAmount, currency)} · {t(lang, 'goalRemaining')}: {formatMoney(remaining, currency)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-[20px] border border-zinc-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{t(lang,'lastOps')}</h3>
          <span className="text-xs text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-full">{transactions.length} {t(lang,'ops')}</span>
        </div>

        <div className="space-y-1">
          {/* «Последние операции» — поверх ВСЕХ операций (transactions), а не filtered:
              смена периода не должна прятать свежие записи. */}
          {transactions.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-8">{t(lang,'noOps')}</p>
          ) : (
            transactions.slice(0, 10).map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-3 px-2 -mx-2 rounded-xl hover:bg-zinc-50 transition group">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${t.type === 'income' ? 'bg-emerald-50 border border-emerald-100' : 'bg-zinc-50 border border-zinc-200'}`}>
                  {getCategoryIcon(categories, t)}
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={()=> onEdit?.(t)}>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    {getCategoryLabel(categories, t, lang)}
                    <span className="text-zinc-400 font-normal text-xs hidden sm:inline">• {formatDateRelative(t.date, lang)}</span>
                  </p>
                  <p className="text-sm text-zinc-500 truncate">{t.comment ?? getCategoryLabel(categories, t, lang)}</p>
                </div>
                <p className={`text-sm font-semibold shrink-0 ${t.type === 'income' ? 'text-emerald-600' : 'text-zinc-900'}`}>
                  {formatMoneyWithSign(t.amount, t.type, currency)}
                </p>
                <button onClick={()=> onEdit?.(t)} className="w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center opacity-100 lg:opacity-0 group-hover:opacity-100 transition">
                  <Pencil className="w-3.5 h-3.5 text-zinc-600" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
