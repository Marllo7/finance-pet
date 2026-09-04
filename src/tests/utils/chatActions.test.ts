import { describe, it, expect } from 'vitest'
import {
  extractAction,
  isPetAction,
  actionToTransaction,
  actionToGoal,
  describeAction,
  toAmount,
  findGoalByName,
  findTransactionBySearch,
} from '../../utils/chatActions'

describe('extractAction', () => {
  it('extracts JSON action from the end of reply and strips it from text', () => {
    const reply = 'Учел расход. Добавил в категорию Еда 200 ₽. {"action":"create_transaction","type":"expense","amount":200,"category":"Еда","date":"2026-09-01","comment":"кофе"}'
    const { text, action } = extractAction(reply)

    expect(text).toBe('Учел расход. Добавил в категорию Еда 200 ₽.')
    expect(action).toBeDefined()
    expect(action!.action).toBe('create_transaction')
    if (action?.action === 'create_transaction') {
      expect(action.type).toBe('expense')
      expect(action.amount).toBe(200)
    }
  })

  it('returns text unchanged when there is no action JSON', () => {
    const reply = 'Просто дружелюбный ответ без действий'
    const { text, action } = extractAction(reply)
    expect(text).toBe(reply)
    expect(action).toBeUndefined()
  })

  it('extracts create_goal action', () => {
    const reply = 'Отличная цель! {"action":"create_goal","name":"Телефон","targetAmount":50000,"icon":"📱","savedAmount":0,"deadline":""}'
    const { text, action } = extractAction(reply)

    expect(text).toBe('Отличная цель!')
    expect(action!.action).toBe('create_goal')
  })

  it('handles invalid JSON gracefully', () => {
    const reply = 'Текст {"action":"broken'
    const { text, action } = extractAction(reply)
    expect(text).toContain('Текст')
    expect(action).toBeUndefined()
  })
})

describe('isPetAction', () => {
  it('validates correct transaction action', () => {
    expect(isPetAction({ action: 'create_transaction', type: 'expense', amount: 100, category: 'Еда' })).toBe(true)
  })

  it('rejects transaction with non-positive amount', () => {
    expect(isPetAction({ action: 'create_transaction', type: 'expense', amount: 0, category: 'Еда' })).toBe(false)
    expect(isPetAction({ action: 'create_transaction', type: 'expense', amount: -5, category: 'Еда' })).toBe(false)
  })

  it('rejects goal without name', () => {
    expect(isPetAction({ action: 'create_goal', name: '', targetAmount: 100 })).toBe(false)
  })

  it('rejects unknown action types and non-objects', () => {
    expect(isPetAction({ action: 'delete_everything' })).toBe(false)
    expect(isPetAction(null)).toBe(false)
    expect(isPetAction('string')).toBe(false)
  })
})

describe('actionToTransaction', () => {
  it('maps action fields to Transaction', () => {
    const t = actionToTransaction({
      action: 'create_transaction',
      type: 'income',
      amount: 80000,
      category: 'Зарплата',
      date: '2026-09-01',
      comment: 'зарплата',
    })
    expect(t.type).toBe('income')
    expect(t.amount).toBe(80000)
    expect(t.category).toBe('Зарплата')
    expect(t.date).toBe('2026-09-01')
    expect(t.comment).toBe('зарплата')
    expect(t.id).toBeTruthy()
  })

  it('replaces invalid date with today', () => {
    const t = actionToTransaction({
      action: 'create_transaction',
      type: 'expense',
      amount: 10,
      category: 'Еда',
      date: 'not-a-date',
    })
    expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('actionToGoal', () => {
  it('maps action fields to Goal with defaults', () => {
    const g = actionToGoal({
      action: 'create_goal',
      name: 'Подарок Жене',
      targetAmount: 7000,
      icon: '🎁',
      savedAmount: 0,
      deadline: '',
    })
    expect(g.name).toBe('Подарок Жене')
    expect(g.targetAmount).toBe(7000)
    expect(g.icon).toBe('🎁')
    expect(g.savedAmount).toBe(0)
    expect(g.deadline).toBeUndefined()
  })
})

describe('describeAction', () => {
  it('describes transaction in ru', () => {
    const text = describeAction({
      action: 'create_transaction',
      type: 'expense',
      amount: 200,
      category: 'Еда',
      date: '2026-09-01',
    }, 'ru')
    expect(text).toContain('расход')
    expect(text).toContain('200')
    expect(text).toContain('Еда')
  })

  it('describes goal in ru', () => {
    const text = describeAction({
      action: 'create_goal',
      name: 'Отпуск',
      targetAmount: 100000,
    }, 'ru')
    expect(text).toContain('Создать цель')
    expect(text).toContain('Отпуск')
  })
})

describe('extractAction edge cases (appended)', () => {
  it('handles apostrophe in text plus trailing JSON', () => {
    const reply = 'It\'s done. {"action":"create_transaction","type":"expense","amount":200,"category":"Food","date":"2026-09-01"}'
    const { text, action } = extractAction(reply)
    expect(action).toBeDefined()
    expect(action!.action).toBe('create_transaction')
    expect(text).toContain("It's done.")
    expect(text).not.toContain('"action"')
  })

  it('accepts string amount with thousands separator', () => {
    expect(isPetAction({ action: 'create_transaction', type: 'expense', amount: '1.000,50', category: 'Еда' })).toBe(true)
    const t = actionToTransaction({
      action: 'create_transaction',
      type: 'expense',
      amount: '1.000,50',
      category: 'Еда',
      date: '2026-09-01',
    })
    expect(t.amount).toBe(1000.5)
  })

  it('rejects empty category as invalid', () => {
    expect(isPetAction({ action: 'create_transaction', type: 'expense', amount: 100, category: '' })).toBe(false)
  })

  it('strips unknown action JSON from text instead of leaking it', () => {
    const reply = 'Готово! {"action":"do_magic","spell":"fireball"}'
    const { text, action } = extractAction(reply)
    expect(text).toBe('Готово!')
    expect(action).toBeUndefined()
    expect(text).not.toContain('"action"')
  })
})

describe('goal/transaction mutations', () => {
  it('validates add_to_goal (incl. string amount)', () => {
    expect(isPetAction({ action: 'add_to_goal', name: 'Ноутбук', amount: 15000 })).toBe(true)
    expect(isPetAction({ action: 'add_to_goal', name: 'Ноутбук', amount: '15 000' })).toBe(true)
    expect(isPetAction({ action: 'add_to_goal', name: '', amount: 100 })).toBe(false)
    expect(isPetAction({ action: 'add_to_goal', name: 'Ноутбук', amount: 0 })).toBe(false)
  })

  it('extracts add_to_goal from reply text (incl. extra fields)', () => {
    // точный кейс из репорта: LLM слал add_to_goal с лишним "date"
    const reply = 'Отложил! {"action":"add_to_goal","name":"Ноутбук","amount":15000,"date":"2026-09-04"}'
    const { text, action } = extractAction(reply)
    expect(text).toBe('Отложил!')
    expect(action?.action).toBe('add_to_goal')
  })

  it('validates update_goal / delete_goal', () => {
    expect(isPetAction({ action: 'update_goal', name: 'Ноутбук', newName: 'MacBook' })).toBe(true)
    expect(isPetAction({ action: 'update_goal', name: 'Ноутбук', targetAmount: 90000 })).toBe(true)
    expect(isPetAction({ action: 'update_goal', name: 'Ноутбук' })).toBe(false)
    expect(isPetAction({ action: 'update_goal', name: '' , newName: 'x' })).toBe(false)
    expect(isPetAction({ action: 'delete_goal', name: 'Ноутбук' })).toBe(true)
    expect(isPetAction({ action: 'delete_goal', name: '' })).toBe(false)
  })

  it('validates update_transaction / delete_transaction', () => {
    expect(isPetAction({ action: 'update_transaction', search: 'кофе', amount: 250 })).toBe(true)
    expect(isPetAction({ action: 'update_transaction', search: 'кофе' })).toBe(false)
    expect(isPetAction({ action: 'update_transaction', search: '', amount: 1 })).toBe(false)
    expect(isPetAction({ action: 'delete_transaction', search: 'кофе' })).toBe(true)
    expect(isPetAction({ action: 'delete_transaction', search: '' })).toBe(false)
  })

  it('toAmount parses strings and rejects garbage', () => {
    expect(toAmount(15000)).toBe(15000)
    expect(toAmount('15 000')).toBe(15000)
    expect(toAmount(0)).toBeNull()
    expect(toAmount('мусор')).toBeNull()
  })

  it('findGoalByName prefers exact match, falls back to substring', () => {
    const goals = [{ name: 'Ноутбук' }, { name: 'Ноутбук новый' }]
    expect(findGoalByName(goals, 'ноутбук')?.name).toBe('Ноутбук')
    expect(findGoalByName(goals, 'новый')?.name).toBe('Ноутбук новый')
    expect(findGoalByName(goals, 'Телефон')).toBeNull()
  })

  it('findTransactionBySearch returns the freshest match', () => {
    const txs = [
      { comment: 'кофе', category: 'Еда', amount: 200 },
      { comment: 'кофе с собой', category: 'Еда', amount: 250 },
    ]
    expect(findTransactionBySearch(txs, 'кофе')?.amount).toBe(250)
    expect(findTransactionBySearch(txs, '250')?.amount).toBe(250)
    expect(findTransactionBySearch(txs, 'чай')).toBeNull()
  })

  it('describes new actions in ru', () => {
    expect(describeAction({ action: 'add_to_goal', name: 'Ноутбук', amount: 15000 }, 'ru')).toContain('Ноутбук')
    expect(describeAction({ action: 'delete_goal', name: 'Ноутбук' }, 'ru')).toContain('Удалить')
    expect(describeAction({ action: 'delete_transaction', search: 'кофе' }, 'ru')).toContain('Удалить')
  })
})
