import { describe, it, expect } from 'vitest'
import { declineName } from '../../utils/declension'

describe('declineName', () => {
  it('declines known names from dictionary, preserving case', () => {
    expect(declineName('Максим', 'ru')).toBe('Максима')
    expect(declineName('Дмитрий', 'ru')).toBe('Дмитрия')
    expect(declineName('Артём', 'ru')).toBe('Артёма')
    expect(declineName('Илья', 'ru')).toBe('Ильи')
    expect(declineName('Никита', 'ru')).toBe('Никиты')
    expect(declineName('Юрий', 'ru')).toBe('Юрия')
  })

  it('declines names by rule: -ий → -ия', () => {
    expect(declineName('Андрей', 'ru')).toBe('Андрея')
    expect(declineName('Алексей', 'ru')).toBe('Алексея')
  })

  it('declines names by rule: согласная → +а', () => {
    expect(declineName('Виктор', 'ru')).toBe('Виктора')
    expect(declineName('Олег', 'ru')).toBe('Олега')
    expect(declineName('Антон', 'ru')).toBe('Антона')
  })

  it('handles empty/null names', () => {
    expect(declineName(null, 'ru')).toBe('неизвестно')
    expect(declineName('', 'ru')).toBe('неизвестно')
    expect(declineName(null, 'en')).toBe('unknown')
  })

  it('returns name as-is for English with unknown name', () => {
    expect(declineName('John', 'en')).toBe('John')
    expect(declineName('Alice', 'en')).toBe('Alice')
  })

  it('returns name as-is for English even with Russian name', () => {
    expect(declineName('Максим', 'en')).toBe('Максим')
    expect(declineName('Дмитрий', 'en')).toBe('Дмитрий')
  })

  it('handles unknown Russian names by rule', () => {
    // Имя на согласную → +а
    expect(declineName('Петр', 'ru')).toBe('Петра')
  })

  it('preserves case: lowercase stays lowercase, ALL CAPS stays ALL CAPS', () => {
    expect(declineName('максим', 'ru')).toBe('максима')
    expect(declineName('МАКСИМ', 'ru')).toBe('МАКСИМА')
  })

  it('declines female names (dictionary)', () => {
    expect(declineName('Анна', 'ru')).toBe('Анны')
    expect(declineName('Мария', 'ru')).toBe('Марии')
    expect(declineName('Ольга', 'ru')).toBe('Ольги')
    expect(declineName('Елена', 'ru')).toBe('Елены')
    expect(declineName('Наталья', 'ru')).toBe('Натальи')
    expect(declineName('Любовь', 'ru')).toBe('Любови')
  })

  it('declines female names by rule without breaking male names', () => {
    // Женские правила: -а → -ы/-и, -я → -и
    expect(declineName('Инна', 'ru')).toBe('Инны')
    expect(declineName('Дарья', 'ru')).toBe('Дарьи')
    // Мужские имена не сломаны
    expect(declineName('Максим', 'ru')).toBe('Максима')
    expect(declineName('Игорь', 'ru')).toBe('Игоря')
    expect(declineName('Илья', 'ru')).toBe('Ильи')
    expect(declineName('Никита', 'ru')).toBe('Никиты')
    expect(declineName('Павел', 'ru')).toBe('Павла')
  })

  it('declines feminine -ель names from dictionary (Эстер indeclinable)', () => {
    expect(declineName('Адель', 'ru')).toBe('Адели')
    expect(declineName('Рахиль', 'ru')).toBe('Рахили')
    expect(declineName('Эсфирь', 'ru')).toBe('Эсфири')
    expect(declineName('Эстер', 'ru')).toBe('Эстер')
  })
})
