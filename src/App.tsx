import { useEffect, useState, lazy, Suspense } from 'react'
import { Layout } from './components/Layout'
import { AddTransactionModal } from './components/AddTransactionModal'
import { EditTransactionModal } from './components/EditTransactionModal'
import { ChatWidget } from './components/ChatWidget'
import { useAuth } from './contexts/AuthContext'
import { useCategories } from './hooks/useCategories'
import { useTransactions } from './hooks/useTransactions'
import { useGoals } from './hooks/useGoals'
import { ConfirmModal } from './components/ConfirmModal'
import { NameStep } from './components/NameStep'
import { SpotlightTour } from './components/SpotlightTour'
import { findCategory } from './utils/categories'
import type { Transaction, Category } from './types/transaction'

// Code-split: страницы грузятся по требованию — recharts уходит в отдельный чанк
// (раньше весь бандл был ~910 KB одним файлом)
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const TransactionsStatsPage = lazy(() => import('./pages/TransactionsStatsPage').then((m) => ({ default: m.TransactionsStatsPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const AuthPage = lazy(() => import('./pages/AuthPage').then((m) => ({ default: m.AuthPage })))
const GoalsPage = lazy(() => import('./pages/GoalsPage').then((m) => ({ default: m.GoalsPage })))
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })))

type Page = 'home' | 'transactions' | 'goals' | 'settings' | 'admin'

function AppInner() {
  const { user, loading: authLoading, userName, petName, profile, profileLoaded, markNameAsked, markTourDone } = useAuth()
  const [page, setPage] = useState<Page>('home')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  
  const isAuthed = !!user

  // Онбординг v2 (строго 1 раз на пользователя, кроссе-девайс через profiles).
  // Источник правды — БД (name_asked/tour_done), localStorage — дубль/fallback.
  // Повтор — только вручную из Профиля (событие fp-tour-restart).
  const [nameOpen, setNameOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  useEffect(() => {
    if (!isAuthed || !user?.id || !profileLoaded) return
    const uid = user.id
    let timer: ReturnType<typeof setTimeout> | null = null
    function asked(): boolean {
      if (profile?.name_asked) return true
      try {
        return !!localStorage.getItem(`fp_name_asked_${uid}`)
      } catch { return false }
    }
    function toured(): boolean {
      if (profile?.tour_done) return true
      try {
        return !!localStorage.getItem(`fp_tour_done_${uid}`)
      } catch { return false }
    }
    if (!asked() || !toured()) {
      // Даём увидеть главную 1.5 сек перед шагом имени
      timer = setTimeout(() => {
        if (!asked()) setNameOpen(true)
        else if (!toured()) setTourOpen(true)
      }, 1500)
    }
    function onRestart() {
      // Рестарт из Профиля: сначала на первую страницу, тур — поверх неё
      setPage('home')
      try {
        window.scrollTo({ top: 0 })
      } catch { /* ignore */ }
      setNameOpen(false)
      setTourOpen(true)
    }
    window.addEventListener('fp-tour-restart', onRestart)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('fp-tour-restart', onRestart)
    }
  }, [isAuthed, user?.id, profileLoaded, profile?.name_asked, profile?.tour_done])

  function finishName() {
    try {
      if (user?.id) localStorage.setItem(`fp_name_asked_${user.id}`, 'done')
    } catch { /* ignore */ }
    void markNameAsked()
    setNameOpen(false)
    const toured = profile?.tour_done || (() => {
      try { return !!localStorage.getItem(`fp_tour_done_${user?.id}`) } catch { return false }
    })()
    if (!toured) setTourOpen(true)
  }

  function finishTour() {
    try {
      if (user?.id) localStorage.setItem(`fp_tour_done_${user.id}`, 'done')
    } catch { /* ignore */ }
    void markTourDone()
    setTourOpen(false)
  }
  
  // Confirm modals
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<string | null>(null)

  const { categories, createCategory, deleteCategory } = useCategories(user?.id)
  const { transactions, loading: txLoading, addTransaction, deleteTransaction, updateTransaction } = useTransactions(user?.id, true)
  const { goals, loading: goalsLoading, addGoal, updateGoal, deleteGoal } = useGoals(user?.id)

  const displayCategories = categories

  async function handleAdd(t: Transaction, categoryId: string | null): Promise<{ error: string | null }> {
    const { error } = await addTransaction(t, categoryId)
    if (error) alert(error)
    return { error: error ?? null }
  }

  async function handleCreateCategory(label: string, icon: string, type: Category['type']) {
    return await createCategory(label, icon, type)
  }

  async function handleUpdate(id: string, patch: Partial<Transaction>, categoryId: string | null){
    const { error } = await updateTransaction(id, patch, categoryId)
    if(error) alert(error)
    return { error: error ?? null }
  }
  
  function requestDeleteTransaction(id: string) {
    setConfirmDeleteTx(id)
  }
  
  async function executeDeleteTransaction() {
    if (!confirmDeleteTx) return
    const id = confirmDeleteTx
    setConfirmDeleteTx(null)
    const { error } = await deleteTransaction(id)
    if (error) alert(error)
  }

  // Действия питомца из чата (после подтверждения пользователем)
  async function handlePetAddTransaction(t: Transaction) {
    const cat = findCategory(displayCategories, t.category)
    return await handleAdd(t, cat?.id ?? null)
  }

  async function handlePetAddGoal(g: { name: string; icon: string; targetAmount: number; savedAmount: number; deadline?: string }) {
    return await addGoal(g)
  }

  // Прямые действия питомца (без ConfirmModal — пользователь уже попросил в чате,
  // результат виден в сообщении; ошибки тоже показываем там)
  async function handlePetDeleteTransaction(id: string) {
    return await deleteTransaction(id)
  }

  async function handlePetDeleteGoal(id: string) {
    return await deleteGoal(id)
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f8f7fb]"><p className="text-zinc-500">Загрузка...</p></div>
  }

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-[#f8f7fb]">
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-zinc-200 px-4 py-3 flex items-center justify-between lg:hidden">
          <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-lg bg-[#7c5cff] flex items-center justify-center"><svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg></div><span className="font-semibold">Finance Pet</span></div>
        </header>
        <Suspense fallback={<p className="text-sm text-zinc-500 text-center py-8">Загрузка...</p>}>
          <AuthPage />
        </Suspense>
      </div>
    )
  }

  return (
    <Layout currentPage={page} onNavigate={setPage} onAddClick={() => setModalOpen(true)}>
      {txLoading ? <p className="text-sm text-zinc-500 text-center py-8">Загрузка операций...</p> : (
        <Suspense fallback={<p className="text-sm text-zinc-500 text-center py-8">Загрузка...</p>}>
          {page === 'home' && <Dashboard transactions={transactions} categories={displayCategories} goals={goals} petName={petName} onEdit={setEditTx} />}
          {page === 'transactions' && <TransactionsStatsPage transactions={transactions} categories={displayCategories} onDelete={requestDeleteTransaction} onEdit={setEditTx} />}
          {page === 'goals' && <GoalsPage goals={goals} loading={goalsLoading} onAddGoal={addGoal} onUpdateGoal={updateGoal} onDeleteGoal={deleteGoal} />}
          {page === 'settings' && <ProfilePage categories={displayCategories} onAdmin={() => setPage('admin')} onDelete={async (id) => { const { error } = await deleteCategory(id); if (error) throw new Error(error) }} />}
          {page === 'admin' && <AdminPage onBack={() => setPage('settings')} />}
        </Suspense>
      )}

      {/* Chat widget — fixed position, appears on all pages */}
      {isAuthed && (
        <ChatWidget
          transactions={transactions}
          goals={goals}
          categories={displayCategories}
          userName={userName}
          petName={petName}
          userId={user?.id ?? null}
          onAddTransaction={handlePetAddTransaction}
          onAddGoal={handlePetAddGoal}
          onUpdateTransaction={handleUpdate}
          onDeleteTransaction={handlePetDeleteTransaction}
          onUpdateGoal={updateGoal}
          onDeleteGoal={handlePetDeleteGoal}
        />
      )}

      <AddTransactionModal open={modalOpen} onClose={() => setModalOpen(false)} onAdd={handleAdd} categories={displayCategories} onCreateCategory={handleCreateCategory} />
      <EditTransactionModal open={!!editTx} transaction={editTx} categories={displayCategories} onClose={()=>setEditTx(null)} onSave={handleUpdate} onDelete={()=>{ if(editTx) requestDeleteTransaction(editTx.id) }} />
      
      {/* Confirm delete transaction */}
      {confirmDeleteTx && (
        <ConfirmModal
          open={!!confirmDeleteTx}
          title="Удалить операцию?"
          description="Это действие нельзя отменить."
          onCancel={() => setConfirmDeleteTx(null)}
          onConfirm={executeDeleteTransaction}
        />
      )}

      {/* Онбординг v2: имя → тур */}
      {nameOpen && <NameStep onDone={finishName} />}
      {tourOpen && !nameOpen && <SpotlightTour onDone={finishTour} />}
    </Layout>
  )
}

export default function App() {
  return <AppInner />
}
