import { describe, it, expect } from 'vitest'
import { extractAction, findTransactionBySearch } from '../../utils/chatActions'
import type { Transaction } from '../../types/transaction'

function tx(partial: Partial<Transaction> = {}): Transaction {
  return { id: '1', type: 'expense', amount: 250, category: 'Еда', date: '2026-09-04', comment: 'кофе', ...partial }
}

/**
 * Регресс: полный цикл удаления "попросил → LLM-ответ → нашли запись".
 * Если модель пришлёт search под другим именем — действие всё равно находится.
 */
describe('delete flow end-to-end (client pipeline)', () => {
  const history = [tx(), tx({ id: '2', comment: 'хлеб', amount: 100 })]

  it('classic shape works', () => {
    const reply = 'Удаляю! {"action":"delete_transaction","search":"кофе"}'
    const { text, action } = extractAction(reply)
    expect(text).toBe('Удаляю!')
    expect(action).toMatchObject({ action: 'delete_transaction', search: 'кофе' })
    if (action?.action === 'delete_transaction') {
      expect(findTransactionBySearch(history, action.search)?.id).toBe('1')
    } else {
      throw new Error('action lost')
    }
  })

  it('code-fenced reply works', () => {
    const reply = 'Готово!\n```json\n{"action": "delete_transaction", "search": "хлеб"}\n```'
    const { action } = extractAction(reply)
    expect(action?.action).toBe('delete_transaction')
    if (action?.action === 'delete_transaction') {
      expect(findTransactionBySearch(history, action.search)?.id).toBe('2')
    } else {
      throw new Error('action lost')
    }
  })

  it.each(['query', 'text', 'name', 'description'])('alias "%s" maps to search', (field) => {
    const reply = `Удаляю! {"action":"delete_transaction","${field}":"кофе"}`
    const { action } = extractAction(reply)
    expect(action).toMatchObject({ action: 'delete_transaction', search: 'кофе' })
  })

  it('matches by amount when search is a number', () => {
    const reply = '{"action":"delete_transaction","search":"100"}'
    const { action } = extractAction(reply)
    if (action?.action === 'delete_transaction') {
      expect(findTransactionBySearch(history, action.search)?.id).toBe('2')
    } else {
      throw new Error('action lost')
    }
  })

  it('unknown action never leaks raw JSON and yields no action', () => {
    const { text, action } = extractAction('Держи {"action":"fly_to_moon"} конец')
    expect(action).toBeUndefined()
    expect(text).not.toContain('fly_to_moon')
  })
})
