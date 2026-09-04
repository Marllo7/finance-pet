import { describe, it, expect } from 'vitest'
import { getCategoryIcon, getCategoryLabel, findCategory } from '../../utils/categories'
import type { Category } from '../../types/transaction'

// Симуляция Supabase-режима: id — UUID, операции ссылаются на категории по id или по label
const supabaseCategories: Category[] = [
  { id: 'uuid-food', label: 'Еда', icon: '🍔', type: 'expense' },
  { id: 'uuid-transport', label: 'Транспорт', icon: '🚆', type: 'expense' },
  { id: 'uuid-salary', label: 'Зарплата', icon: '💰', type: 'income' },
  { id: 'uuid-other', label: 'Другое', icon: '📦', type: 'both' },
]

// Локальный fallback-режим: id — человекочитаемые ключи
const localCategories: Category[] = [
  { id: 'food', label: 'Еда', icon: '🍔', type: 'expense', isDefault: true },
  { id: 'other', label: 'Другое', icon: '📦', type: 'both', isDefault: true },
]

describe('getCategoryIcon', () => {
  it('returns icon by category id (local mode)', () => {
    expect(getCategoryIcon(localCategories, { category: 'food' })).toBe('🍔')
  })

  it('returns icon by category uuid (Supabase mode)', () => {
    expect(getCategoryIcon(supabaseCategories, { category: 'uuid-transport' })).toBe('🚆')
  })

  it('returns icon by category label (Supabase fallback mode)', () => {
    // Операции, созданные до миграции, хранят label вместо id
    expect(getCategoryIcon(supabaseCategories, { category: 'Зарплата' })).toBe('💰')
  })

  it('returns icon by category label case-insensitively', () => {
    expect(getCategoryIcon(supabaseCategories, { category: 'еда' })).toBe('🍔')
  })

  it('prefers transaction icon when present', () => {
    expect(getCategoryIcon(supabaseCategories, { category: 'uuid-food', icon: '🥗' })).toBe('🥗')
  })

  it('falls back to "other" icon for unknown category', () => {
    expect(getCategoryIcon(supabaseCategories, { category: 'unknown-cat' })).toBe('📦')
    expect(getCategoryIcon(supabaseCategories, { category: '' })).toBe('📦')
  })

  it('returns "other" icon for the "other" category itself', () => {
    expect(getCategoryIcon(supabaseCategories, { category: 'uuid-other' })).toBe('📦')
  })
})

describe('getCategoryLabel', () => {
  it('returns localized label in ru', () => {
    expect(getCategoryLabel(supabaseCategories, { category: 'uuid-food' }, 'ru')).toBe('Еда')
  })

  it('returns localized label in en for default categories', () => {
    expect(getCategoryLabel(supabaseCategories, { category: 'uuid-food' }, 'en')).toBe('Food')
  })

  it('falls back to raw category key when not found', () => {
    expect(getCategoryLabel(supabaseCategories, { category: 'mystery' }, 'ru')).toBe('mystery')
  })
})

describe('findCategory', () => {
  it('finds by id first', () => {
    expect(findCategory(supabaseCategories, 'uuid-salary')?.label).toBe('Зарплата')
  })

  it('finds by label when id is not matched', () => {
    expect(findCategory(supabaseCategories, 'Транспорт')?.id).toBe('uuid-transport')
  })

  it('returns undefined for empty key', () => {
    expect(findCategory(supabaseCategories, '')).toBeUndefined()
  })
})
