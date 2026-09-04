import { useState } from 'react'
import { useSettings } from '../contexts/SettingsContext'
import { Sparkles, ChevronRight, ChevronLeft, X, Cat, Wallet, PieChart, Target, MessageCircle, PartyPopper, Check } from 'lucide-react'

const ONBOARDING_KEY = 'pet_onboarding_done'

type LucideIcon = typeof Cat

interface Step {
  title: string
  description: string
  icon: LucideIcon
}

const steps: Step[] = [
  {
    title: 'Операции',
    description: 'Здесь ты видишь все свои доходы и расходы. Можно фильтровать по категории, дате или искать по тексту. Нажми на операцию, чтобы редактировать.',
    icon: Wallet,
  },
  {
    title: 'Статистика',
    description: 'Графики и диаграммы показывают, куда уходят деньги. Круговая диаграмма — расходы по категориям, столбцы — динамика по месяцам. Переключай период вверху страницы.',
    icon: PieChart,
  },
  {
    title: 'Цели',
    description: 'Создавай цели для накоплений! Например, на телефон, отпуск или машину. Я буду показывать прогресс и напоминать, если ты отстаёшь.',
    icon: Target,
  },
  {
    title: 'Чат с питомцем',
    description: 'Нажми на карточку питомца на главной странице, чтобы открыть чат. Я могу ответить на вопросы, подсказать статистику или просто поболтать!',
    icon: MessageCircle,
  },
  {
    title: 'Готово!',
    description: 'Теперь ты знаешь основы. Я всегда рядом, чтобы помочь. Удачи с финансами!',
    icon: PartyPopper,
  },
]

export function OnboardingModal() {
  const { lang } = useSettings()
  // null = экран приглашения (пользователь ещё не решил, проходить ли обучение)
  const [currentStep, setCurrentStep] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_KEY) !== 'true'
    } catch {
      return true
    }
  })

  const invited = currentStep === null
  const step = currentStep !== null ? steps[currentStep] : null
  const isLastStep = currentStep === steps.length - 1
  const isFirstStep = currentStep === 0

  function nextStep() {
    if (currentStep === null) {
      setCurrentStep(0)
      return
    }
    if (isLastStep) {
      completeOnboarding()
    } else {
      setCurrentStep(currentStep + 1)
    }
  }

  function prevStep() {
    if (currentStep !== null && currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  function completeOnboarding() {
    try {
      localStorage.setItem(ONBOARDING_KEY, 'true')
    } catch {
      // private mode: localStorage недоступен — просто закрываем
    }
    setShowModal(false)
  }

  if (!showModal) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      <div className="relative bg-white w-full max-w-[500px] rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Header gradient */}
        <div className="bg-gradient-to-br from-[#7c5cff] to-[#9d7cff] p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm font-medium opacity-90">
                {lang === 'ru' ? 'Обучение' : 'Onboarding'}
              </span>
            </div>
            <button
              onClick={completeOnboarding}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress */}
          {!invited && (
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all ${
                    currentStep !== null && i <= currentStep ? 'bg-white' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {invited ? (
          /* Invitation screen — обучение необязательное */
          <div className="p-6 space-y-5 text-center">
            <div className="w-20 h-20 rounded-full bg-[#7c5cff]/10 flex items-center justify-center mx-auto">
              <Cat className="w-10 h-10 text-[#7c5cff]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900 mb-2">
                {lang === 'ru' ? 'Привет! Я твой питомец-помощник' : 'Hi! I am your pet assistant'}
              </h2>
              <p className="text-sm text-zinc-600 leading-relaxed">
                {lang === 'ru'
                  ? 'Я помогу тебе управлять финансами, давать советы и следить за целями. Хочешь, я коротко покажу, как всё работает?'
                  : 'I will help you manage finances, give advice and track goals. Want me to show you how everything works?'}
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={completeOnboarding}
                className="flex-1 py-3 rounded-xl border border-zinc-200 bg-white font-medium text-zinc-700 hover:bg-zinc-50 transition"
              >
                {lang === 'ru' ? 'Пропустить' : 'Skip'}
              </button>
              <button
                onClick={nextStep}
                className="flex-1 py-3 rounded-xl bg-[#7c5cff] text-white font-medium hover:bg-[#6b4de6] transition flex items-center justify-center gap-2"
              >
                {lang === 'ru' ? 'Пройти обучение' : 'Start tour'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : step && (
          /* Content */
          <div className="p-6 space-y-5">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-[#7c5cff]/10 flex items-center justify-center mx-auto mb-3">
                <step.icon className="w-10 h-10 text-[#7c5cff]" />
              </div>
              <h2 className="text-xl font-bold text-zinc-900 mb-2">{step.title}</h2>
              <p className="text-sm text-zinc-600 leading-relaxed">{step.description}</p>
            </div>

            {/* Navigation */}
            <div className="flex gap-3 pt-2">
              {!isFirstStep && (
                <button
                  onClick={prevStep}
                  className="flex-1 py-3 rounded-xl border border-zinc-200 bg-white font-medium text-zinc-700 hover:bg-zinc-50 transition flex items-center justify-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {lang === 'ru' ? 'Назад' : 'Back'}
                </button>
              )}
              <button
                onClick={nextStep}
                className="flex-1 py-3 rounded-xl bg-[#7c5cff] text-white font-medium hover:bg-[#6b4de6] transition flex items-center justify-center gap-2"
              >
                {isLastStep
                  ? (lang === 'ru' ? 'Готово' : 'Done')
                  : (lang === 'ru' ? 'Далее' : 'Next')}
                {isLastStep ? <Check className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>

            {/* Step indicator */}
            <p className="text-center text-xs text-zinc-400">
              {(currentStep ?? 0) + 1} / {steps.length}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
