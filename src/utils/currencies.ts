export type CurrencyCode = 'EUR' | 'USD' | 'RUB' | 'GBP' | 'KZT'

export interface Currency {
  code: CurrencyCode
  symbol: string
  /** Название по языкам: ru / en */
  labels: { ru: string; en: string }
  locale: string
}

export const currencies: Currency[] = [
  { code: 'EUR', symbol: '€', labels: { ru: 'Евро', en: 'Euro' }, locale: 'de-DE' },
  { code: 'USD', symbol: '$', labels: { ru: 'Доллар', en: 'Dollar' }, locale: 'en-US' },
  { code: 'RUB', symbol: '₽', labels: { ru: 'Рубль', en: 'Ruble' }, locale: 'ru-RU' },
  { code: 'GBP', symbol: '£', labels: { ru: 'Фунт', en: 'Pound' }, locale: 'en-GB' },
  { code: 'KZT', symbol: '₸', labels: { ru: 'Тенге', en: 'Tenge' }, locale: 'kk-KZ' },
]

export function getCurrency(code: string): Currency {
  const found = currencies.find(c => c.code === code)
  if (!found) {
    console.warn(`Unknown currency code: ${code}, fallback to EUR`)
    return currencies.find(c => c.code === 'EUR') ?? currencies[0]
  }
  return found
}

// Локализованное название валюты
export function getCurrencyLabel(code: string, lang: 'ru' | 'en'): string {
  return getCurrency(code).labels[lang]
}
export function formatMoney(amount: number, code: CurrencyCode): string {
  const cur = getCurrency(code)
  return new Intl.NumberFormat(cur.locale, { style: 'currency', currency: cur.code }).format(amount)
}
export function formatMoneyWithSign(amount: number, type: 'income'|'expense', code: CurrencyCode): string {
  const prefix = type === 'income' ? '+ ' : '- '
  return prefix + formatMoney(Math.abs(amount), code)
}
