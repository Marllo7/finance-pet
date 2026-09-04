import type { CurrencyCode } from '../utils/currencies'
import type { Lang } from '../i18n'

export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  category: string
  date: string // ISO string YYYY-MM-DD
  comment?: string
  icon?: string
}

export interface Category {
  id: string
  label: string
  icon: string
  type: TransactionType | 'both'
  isDefault?: boolean
}

export interface Goal {
  id: string
  name: string
  icon: string
  targetAmount: number
  savedAmount: number
  deadline?: string // YYYY-MM-DD
  color?: string
  createdAt: string
}

export interface Profile {
  id: string
  email: string
  name?: string
  pet_name?: string
  currency?: CurrencyCode
  language?: Lang
  name_asked?: boolean
  tour_done?: boolean
  createdAt: string
}
