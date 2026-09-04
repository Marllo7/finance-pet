import { cn } from '../lib/cn'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { t } from '../i18n'
import { capitalize } from '../utils/capitalize'
import { Home, CreditCard, Target, User, Plus, LogOut, Wallet, Smile } from 'lucide-react'

type Page = 'home' | 'transactions' | 'goals' | 'settings' | 'admin'

const iconMap = {
  home: Home,
  transactions: CreditCard,
  goals: Target,
  settings: User,
} as const

interface LayoutProps {
  currentPage: Page
  onNavigate: (p: Page) => void
  onAddClick: () => void
  children: React.ReactNode
}

export function Layout({ currentPage, onNavigate, onAddClick, children }: LayoutProps) {
  const { user, signOut, userName } = useAuth()
  const { lang, setLang } = useSettings()
  const navItems: { id: 'home' | 'transactions' | 'goals' | 'settings'; label: string }[] = [
    { id: 'home', label: t(lang, 'navHome') },
    { id: 'transactions', label: t(lang, 'navTransactions') },
    { id: 'goals', label: t(lang, 'navGoals') },
    { id: 'settings', label: t(lang, 'navSettings') },
  ]

  return (
    <div className="min-h-screen bg-[#f8f7fb] text-[#1e1e2e] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside data-tour="nav" className="hidden lg:flex w-[260px] shrink-0 bg-white border-r border-zinc-200 flex-col sticky top-0 h-screen">
        <div className="px-7 py-6 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#7c5cff] flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-[17px] tracking-tight">Finance Pet</span>
        </div>

        <nav className="px-3 flex-1">
          {navItems.map((item) => {
            const NavI = iconMap[item.id]
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors text-left',
                  currentPage === item.id
                    ? 'bg-[#f1efff] text-[#7c5cff]'
                    : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900',
                )}
              >
                <NavI className="w-5 h-5" />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="p-4 border-t border-zinc-100 space-y-3">
          <div className="flex gap-1 p-1 bg-zinc-100 rounded-xl">
            <button onClick={()=>setLang('ru')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${lang==='ru'?'bg-white shadow-sm':''}`}>RU</button>
            <button onClick={()=>setLang('en')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${lang==='en'?'bg-white shadow-sm':''}`}>EN</button>
          </div>
          <button
            data-tour="fab"
            onClick={onAddClick}
            className="w-full bg-[#7c5cff] hover:bg-[#6b4de6] text-white rounded-xl py-3 font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> {t(lang, 'newOperation')}
          </button>
          {user ? (
            <div className="bg-zinc-50 rounded-xl p-3">
              {userName && <p className="text-sm font-medium truncate">{capitalize(userName)}</p>}
              <p className="text-xs text-zinc-500 truncate">{user.email}</p>
              <button onClick={signOut} className="text-xs text-zinc-600 underline mt-1 flex items-center gap-1">
                <LogOut className="w-3 h-3" /> {t(lang, 'logout')}
              </button>
            </div>
          ) : (
            <p className="text-xs text-zinc-400 text-center">{t(lang, 'version')}</p>
          )}
        </div>
      </aside>

      {/* Mobile top header */}
      <header className="lg:hidden sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-zinc-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#7c5cff] flex items-center justify-center">
            <Wallet className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold tracking-tight">Finance Pet</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Compact language toggle — split button */}
          <button
            onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}
            className="flex items-center border border-zinc-200 rounded-full overflow-hidden"
          >
            <span className={`px-2 py-1 text-[10px] font-bold leading-none ${lang === 'ru' ? 'bg-[#7c5cff] text-white' : 'text-zinc-400'}`}>
              RU
            </span>
            <span className={`px-2 py-1 text-[10px] font-bold leading-none ${lang === 'en' ? 'bg-[#7c5cff] text-white' : 'text-zinc-400'}`}>
              EN
            </span>
          </button>
          {user && (
            <span className="text-xs text-zinc-500 max-w-[120px] truncate hidden sm:block">{capitalize(userName || user.email)}</span>
          )}
          {user ? (
            <button onClick={signOut} className="text-xs bg-zinc-100 px-2.5 py-1.5 rounded-full flex items-center gap-1">
              <LogOut className="w-3 h-3" /> {t(lang, 'logout')}
            </button>
          ) : (
            <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
              <Smile className="w-4 h-4 text-zinc-400" />
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 px-4 lg:px-8 py-6 pb-24 lg:pb-8 max-w-[960px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav data-tour="nav" className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-zinc-200 flex items-center justify-around py-2 pb-[max(8px,env(safe-area-inset-bottom))] z-20">
        {navItems.map((item) => {
          const NavI = iconMap[item.id]
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors min-w-[64px]',
                currentPage === item.id ? 'text-[#7c5cff]' : 'text-zinc-400',
              )}
            >
              <NavI className="w-5 h-5" />
              <span className="text-[11px] font-medium">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Mobile FAB */}
      <button
        data-tour="fab"
        onClick={onAddClick}
        aria-label="Новая операция"
        className="lg:hidden fixed bottom-[76px] left-4 w-14 h-14 rounded-full bg-[#7c5cff] hover:bg-[#6b4de6] text-white shadow-lg shadow-violet-200 flex items-center justify-center z-20 transition-colors"
      >
        <Plus className="w-7 h-7" />
      </button>
    </div>
  )
}
