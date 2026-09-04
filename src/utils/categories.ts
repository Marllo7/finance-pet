import type { Category } from '../types/transaction'

export const categories: Category[] = [
  { id: 'food', label: 'Еда', icon: '🍔', type: 'expense', isDefault: true },
  { id: 'transport', label: 'Транспорт', icon: '🚆', type: 'expense', isDefault: true },
  { id: 'shopping', label: 'Покупки', icon: '🛍️', type: 'expense', isDefault: true },
  { id: 'home', label: 'Дом', icon: '🏠', type: 'expense', isDefault: true },
  { id: 'entertainment', label: 'Развлечения', icon: '🎬', type: 'expense', isDefault: true },
  { id: 'health', label: 'Здоровье', icon: '💊', type: 'expense', isDefault: true },
  { id: 'salary', label: 'Зарплата', icon: '💰', type: 'income', isDefault: true },
  { id: 'freelance', label: 'Фриланс', icon: '💻', type: 'income', isDefault: true },
  { id: 'other', label: 'Другое', icon: '📦', type: 'both', isDefault: true },
]

// Переводы базовых категорий: по локальному id (fallback-режим)
const categoryTranslations: Record<string, { ru: string; en: string }> = {
  food: { ru: 'Еда', en: 'Food' },
  transport: { ru: 'Транспорт', en: 'Transport' },
  shopping: { ru: 'Покупки', en: 'Shopping' },
  home: { ru: 'Дом', en: 'Home' },
  entertainment: { ru: 'Развлечения', en: 'Entertainment' },
  health: { ru: 'Здоровье', en: 'Health' },
  salary: { ru: 'Зарплата', en: 'Salary' },
  freelance: { ru: 'Фриланс', en: 'Freelance' },
  other: { ru: 'Другое', en: 'Other' },
}

// По русскому label (Supabase-режим: id — UUID, seed-категории с русскими label)
const labelTranslations: Record<string, string> = {
  'Еда': 'Food',
  'Транспорт': 'Transport',
  'Покупки': 'Shopping',
  'Дом': 'Home',
  'Развлечения': 'Entertainment',
  'Здоровье': 'Health',
  'Зарплата': 'Salary',
  'Фриланс': 'Freelance',
  'Другое': 'Other',
}

// Локализованный label базовой категории; кастомные возвращаются как есть
export function localizeCategoryLabel(cat: Category, lang: 'ru' | 'en'): string {
  if (lang === 'ru') return cat.label
  return categoryTranslations[cat.id]?.en ?? labelTranslations[cat.label] ?? cat.label
}

/**
 * Находит категорию по ключу: сначала по id (uuid / локальный id),
 * затем по label в нижнем регистре (Supabase-режим, где t.category может быть label).
 */
export function findCategory(all: Category[], key: string): Category | undefined {
  if (!key) return undefined
  const lower = key.toLowerCase()
  return all.find((c) => c.id === key) ?? all.find((c) => c.label.toLowerCase() === lower)
}

/**
 * Иконка категории операции с fallback на «Другое» (📦).
 * Приоритет: icon самой операции → категория по id/label → 📦.
 */
export function getCategoryIcon(all: Category[], t: { category: string; icon?: string }): string {
  if (t.icon) return t.icon
  const cat = findCategory(all, t.category)
  return cat?.icon ?? '📦'
}

/**
 * Локализованное название категории операции.
 */
export function getCategoryLabel(all: Category[], t: { category: string }, lang: 'ru' | 'en'): string {
  const cat = findCategory(all, t.category)
  return cat ? localizeCategoryLabel(cat, lang) : t.category
}
