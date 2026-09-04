import { useState } from 'react'
import type { Goal } from '../types/transaction'
import { useSettings } from '../contexts/SettingsContext'
import { t } from '../i18n'
import { AddGoalModal } from '../components/AddGoalModal'
import { QuickAddProgressModal } from '../components/QuickAddProgressModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { formatDate } from '../utils/formatDate'
import { formatMoney } from '../utils/currencies'
import { Pencil, Target, CheckCircle2, Plus } from 'lucide-react'

interface Props {
  goals: Goal[]
  loading: boolean
  onAddGoal: (g: Omit<Goal, 'id' | 'createdAt'>) => Promise<{ error: string | null }>
  onUpdateGoal: (id: string, patch: Partial<Pick<Goal, 'name' | 'icon' | 'targetAmount' | 'savedAmount' | 'deadline' | 'color'>>) => Promise<{ error: string | null }>
  onDeleteGoal: (id: string) => Promise<{ error: string | null }>
}

export function GoalsPage({ goals, loading, onAddGoal, onUpdateGoal, onDeleteGoal }: Props) {
  const { lang, currency } = useSettings()
  const [showCreate, setShowCreate] = useState(false)
  const [editGoal, setEditGoal] = useState<Goal | null>(null)
  const [quickAddGoal, setQuickAddGoal] = useState<Goal | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0)
  const totalSaved = goals.reduce((s, g) => s + g.savedAmount, 0)
  const overallProgress = totalTarget > 0 ? Math.max(0, Math.min(100, Math.round((totalSaved / totalTarget) * 100))) : 0

  if (loading) {
    return <p className="text-sm text-zinc-500 text-center py-12">{lang === 'ru' ? 'Загрузка...' : 'Loading...'}</p>
  }

  function handleAddGoal(g: Omit<Goal, 'id' | 'createdAt'>) {
    return onAddGoal(g)
  }

  function handleUpdateGoal(id: string, patch: Partial<Pick<Goal, 'name' | 'icon' | 'targetAmount' | 'savedAmount' | 'deadline' | 'color'>>) {
    return onUpdateGoal(id, patch)
  }

  function handleQuickAdd(goal: Goal, amount: number) {
    const newSaved = Math.min(goal.savedAmount + amount, goal.targetAmount)
    return onUpdateGoal(goal.id, { savedAmount: newSaved })
  }

  function handleDeleteGoal(id: string) {
    setDeleteError('')
    setConfirmDeleteId(id)
  }

  async function handleConfirmDelete() {
    if (!confirmDeleteId) return
    const id = confirmDeleteId
    try {
      const { error } = await onDeleteGoal(id)
      if (error) {
        setDeleteError(error)
        return
      }
      setConfirmDeleteId(null)
      setDeleteError('')
      if (editGoal && editGoal.id === id) setEditGoal(null)
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold">{t(lang, 'goalsTitle')}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{t(lang, 'goalsSub')}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-[#7c5cff] hover:bg-[#6b4de6] text-white px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-1.5 transition"
        >
          <Plus className="w-4 h-4" /> {t(lang, 'newGoal')}
        </button>
      </div>

      {/* Overall progress */}
      {goals.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-zinc-600">{lang === 'ru' ? 'Общий прогресс' : 'Overall progress'}</span>
            <span className="text-lg font-bold" style={{ color: '#7c5cff' }}>{overallProgress}%</span>
          </div>
          <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${overallProgress}%`, backgroundColor: '#7c5cff' }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-zinc-400">
            <span>{formatMoney(totalSaved, currency)}</span>
            <span>/ {formatMoney(totalTarget, currency)}</span>
          </div>
        </div>
      )}

      {/* Goals list */}
      {goals.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-zinc-100">
          <Target className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">{t(lang, 'goalNoData')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const progress = goal.targetAmount > 0 ? Math.max(0, Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100))) : 0
            const remaining = Math.max(0, goal.targetAmount - goal.savedAmount)
            const isComplete = goal.targetAmount > 0 && goal.savedAmount >= goal.targetAmount

            return (
              <div
                key={goal.id}
                className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                      style={{ backgroundColor: `${goal.color ?? '#7c5cff'}15` }}
                    >
                      {goal.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-[15px]">{goal.name}</h3>
                      {goal.deadline && (
                        <p className="text-xs text-zinc-400">
                          {lang === 'ru' ? 'Срок:' : 'Deadline'}: {formatDate(goal.deadline, lang)}
                        </p>
                      )}
                    </div>
                  </div>
                  {isComplete && (
                    <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {lang === 'ru' ? 'Готово' : 'Done'}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                    <span>{formatMoney(goal.savedAmount, currency)}</span>
                    <span>{formatMoney(goal.targetAmount, currency)}</span>
                  </div>
                  <div className="w-full h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${progress}%`, backgroundColor: goal.color ?? '#7c5cff' }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 text-xs">
                    <span className="text-zinc-400">{t(lang, 'goalRemaining')}: {formatMoney(remaining, currency)}</span>
                    <span className="font-medium" style={{ color: goal.color ?? '#7c5cff' }}>{progress}%</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-zinc-100">
                  <button
                    onClick={() => setQuickAddGoal(goal)}
                    disabled={isComplete}
                    className="flex-1 py-2 rounded-xl text-sm font-medium transition bg-zinc-50 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    + {t(lang, 'goalAddProgress')}
                  </button>
                  <button
                    onClick={() => setEditGoal(goal)}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-zinc-50 text-zinc-700 hover:bg-zinc-100 transition flex items-center gap-1"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      <AddGoalModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={handleAddGoal}
      />
      <AddGoalModal
        open={!!editGoal}
        onClose={() => setEditGoal(null)}
        onSave={(g) => {
          const cur = editGoal
          if (!cur) return Promise.resolve({ error: null })
          return handleUpdateGoal(cur.id, g)
        }}
        initial={editGoal}
        onDelete={() => {
          const cur = editGoal
          if (cur) handleDeleteGoal(cur.id)
        }}
      />
      <QuickAddProgressModal
        open={!!quickAddGoal}
        onClose={() => setQuickAddGoal(null)}
        goalName={quickAddGoal?.name ?? ''}
        goalIcon={quickAddGoal?.icon ?? '🎯'}
        goalSaved={quickAddGoal?.savedAmount ?? 0}
        goalTarget={quickAddGoal?.targetAmount ?? 0}
        onAdd={(amount) => quickAddGoal ? handleQuickAdd(quickAddGoal, amount) : Promise.resolve({ error: null })}
      />

      {/* Confirm delete goal */}
      {deleteError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{deleteError}</p>}
      <ConfirmModal
        open={!!confirmDeleteId}
        title={t(lang, 'goalDeleteConfirm')}
        description={lang === 'ru' ? 'Это действие нельзя отменить.' : 'This action cannot be undone.'}
        confirmLabel={t(lang, 'delete')}
        cancelLabel={t(lang, 'cancel')}
        onCancel={() => { setConfirmDeleteId(null); setDeleteError('') }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
