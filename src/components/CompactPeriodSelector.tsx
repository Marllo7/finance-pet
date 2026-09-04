import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Calendar } from 'lucide-react'
import type { PeriodOption, DateRange } from '../types/date'

interface Props {
  value: PeriodOption
  onChange: (value: PeriodOption) => void
  onRangeChange?: (range: DateRange | null) => void
}

const options: { key: PeriodOption; label: string }[] = [
  { key: 'day', label: '1 день' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
  { key: 'year', label: 'Год' },
  { key: 'all', label: 'Все' },
  { key: 'custom', label: 'Диапазон' },
]

export function CompactPeriodSelector({ value, onChange, onRangeChange }: Props) {
  const [open, setOpen] = useState(false)
  const [showRangePicker, setShowRangePicker] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [rangeError, setRangeError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const prevPeriodRef = useRef<PeriodOption>('month')

  const currentLabel = options.find(o => o.key === value)?.label ?? 'Месяц'

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setShowRangePicker(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(key: PeriodOption) {
    if (key === 'custom') {
      if (value !== 'custom') prevPeriodRef.current = value
      setShowRangePicker(true)
    } else {
      onChange(key)
      onRangeChange?.(null)
      setOpen(false)
      setShowRangePicker(false)
      setRangeError('')
    }
  }

  function handleApplyRange() {
    if (startDate && endDate) {
      if (startDate > endDate) {
        setRangeError('Начальная дата позже конечной / Start date is after end date')
        return
      }
      setRangeError('')
      onRangeChange?.({ start: startDate, end: endDate })
      onChange('custom')
      setShowRangePicker(false)
      setOpen(false)
    }
  }

  function handleResetRange() {
    setStartDate('')
    setEndDate('')
    setRangeError('')
    onChange(prevPeriodRef.current)
    onRangeChange?.(null)
    setShowRangePicker(false)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Main button */}
      <button
        onClick={() => { setOpen(!open); setShowRangePicker(false) }}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-medium hover:bg-zinc-50 transition active:scale-95"
      >
        <Calendar className="w-4 h-4 text-zinc-400" />
        <span>{currentLabel}</span>
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && !showRangePicker && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 bg-white rounded-xl border border-zinc-200 shadow-lg overflow-hidden z-50 min-w-[160px]"
        >
          {options.map(opt => (
            <button
              key={opt.key}
              onClick={() => handleSelect(opt.key)}
              className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                value === opt.key
                  ? 'bg-[#7c5cff] text-white'
                  : 'hover:bg-zinc-50 text-zinc-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Range picker inside dropdown */}
      {showRangePicker && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-xl border border-zinc-200 shadow-lg p-4 z-50 min-w-[260px]">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">С</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-sm focus:border-[#7c5cff] outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">По</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-sm focus:border-[#7c5cff] outline-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleResetRange}
                className="flex-1 py-2 rounded-lg border border-zinc-200 text-xs font-medium hover:bg-zinc-50 transition"
              >
                Сбросить
              </button>
              <button
                onClick={handleApplyRange}
                disabled={!startDate || !endDate}
                className="flex-1 py-2 rounded-lg bg-[#7c5cff] text-white text-xs font-medium hover:bg-[#6b4de6] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Применить
              </button>
            </div>
            {rangeError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">{rangeError}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
