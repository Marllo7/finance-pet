import { describe, it, expect, beforeEach } from 'vitest'
import {
  MAX_MESSAGES,
  computeDragPos,
  dragMovedEnough,
  loadChatHistory,
  mergeRemoteUpdate,
  mergeWithHistory,
  saveChatHistory,
  storageKeyFor,
  stripLegacyGreeting,
  type ChatMessage,
} from '../../utils/chatSync'

const u = (content: string): ChatMessage => ({ role: 'user', content })
const a = (content: string): ChatMessage => ({ role: 'assistant', content })

beforeEach(() => {
  localStorage.clear()
})

describe('storageKeyFor / MAX_MESSAGES', () => {
  it('MAX_MESSAGES is 50', () => {
    expect(MAX_MESSAGES).toBe(50)
  })

  it('guest key for null/undefined, per-user key otherwise', () => {
    expect(storageKeyFor(null)).toBe('pet_chat_history_guest')
    expect(storageKeyFor(undefined)).toBe('pet_chat_history_guest')
    expect(storageKeyFor('abc')).toBe('pet_chat_history_abc')
    expect(storageKeyFor('abc')).not.toBe(storageKeyFor(null))
  })
})

describe('mergeWithHistory', () => {
  it('empty current returns history as-is', () => {
    const h = [u('hi'), a('hello')]
    expect(mergeWithHistory(h, [])).toEqual(h)
  })

  it('matching message is consumed only once (one-to-one)', () => {
    const h = [u('привет')]
    // current содержит 2 копии: одна списывается как дубль history, вторая — свежая
    const result = mergeWithHistory(h, [u('привет'), u('привет')])
    expect(result).toHaveLength(2)
    expect(result).toEqual([u('привет'), u('привет')])
  })

  it('duplicates in current are both preserved when history is empty', () => {
    const result = mergeWithHistory([], [u('ок'), u('ок')])
    expect(result).toHaveLength(2)
    expect(result).toEqual([u('ок'), u('ок')])
  })

  it('history duplicates each consume one current copy', () => {
    const h = [u('ок'), u('ок')]
    const result = mergeWithHistory(h, [u('ок'), u('ок')])
    expect(result).toEqual(h)
  })

  it('fresh messages are appended after history in order', () => {
    const result = mergeWithHistory([u('a')], [u('a'), u('b'), a('c')])
    expect(result).toEqual([u('a'), u('b'), a('c')])
  })

  it('role matters: same content with different role is fresh', () => {
    const result = mergeWithHistory([u('x')], [a('x')])
    expect(result).toEqual([u('x'), a('x')])
  })
})

describe('mergeRemoteUpdate', () => {
  it('remote is authoritative: synced current message not resurrected', () => {
    const synced = JSON.stringify([u('old')])
    const result = mergeRemoteUpdate(synced, [u('new')], [u('old')])
    expect(result).toEqual([u('new')])
  })

  it('dirty (unsent) messages are kept on top of remote', () => {
    const synced = JSON.stringify([u('a')])
    const result = mergeRemoteUpdate(synced, [u('a')], [u('a'), u('dirty')])
    expect(result).toEqual([u('a'), u('dirty')])
  })

  it('remote deletion clears synced messages', () => {
    const synced = JSON.stringify([u('a')])
    const result = mergeRemoteUpdate(synced, [], [u('a')])
    expect(result).toEqual([])
  })

  it('empty synced + empty remote + empty current stays empty', () => {
    expect(mergeRemoteUpdate(JSON.stringify([]), [], [])).toEqual([])
  })

  it('broken lastSyncedJson falls back to remote as synced base', () => {
    const result = mergeRemoteUpdate('{{{broken', [u('a')], [u('a')])
    expect(result).toEqual([u('a')])
  })

  it('null lastSyncedJson falls back to remote as synced base', () => {
    const result = mergeRemoteUpdate(null, [u('a')], [u('a'), u('fresh')])
    expect(result).toEqual([u('a'), u('fresh')])
  })
})

describe('stripLegacyGreeting', () => {
  it('cuts legacy ru greeting', () => {
    const history = [
      a('Привет! Я твой питомец-помощник. Сегодня: ...'),
      u('сколько потратил?'),
    ]
    expect(stripLegacyGreeting(history)).toEqual([u('сколько потратил?')])
  })

  it('cuts legacy en greeting', () => {
    const history = [a('Hi! I am your pet assistant. Today: ...'), u('stats?')]
    expect(stripLegacyGreeting(history)).toEqual([u('stats?')])
  })

  it('keeps live dialog starting with plain "Привет!" (no pet-assistant marker)', () => {
    const history = [a('Привет! Как дела? Чем помочь?'), u('норм')]
    expect(stripLegacyGreeting(history)).toEqual(history)
  })

  it('keeps history starting with user message', () => {
    const history = [u('Привет!'), a('Привет! Чем помочь?')]
    expect(stripLegacyGreeting(history)).toEqual(history)
  })

  it('empty history stays empty', () => {
    expect(stripLegacyGreeting([])).toEqual([])
  })
})

describe('computeDragPos', () => {
  it('is continuous at grab: newRight === innerWidth - rect.right', () => {
    const innerW = 1280
    const innerH = 800
    const rect = { right: 1200, bottom: 700 }
    const clientX = 1180
    const clientY = 680
    const offsetX = rect.right - clientX // 20
    const offsetY = rect.bottom - clientY // 20
    const pos = computeDragPos(clientX, clientY, offsetX, offsetY, innerW, innerH)
    expect(pos.right).toBe(innerW - rect.right)
    expect(pos.bottom).toBe(innerH - rect.bottom)
  })

  it('clamps to min 16 near screen edges', () => {
    const pos = computeDragPos(1279, 799, 0, 0, 1280, 800)
    expect(pos.right).toBe(16)
    expect(pos.bottom).toBe(16)
  })

  it('clamps to inner-60 on overflow', () => {
    const pos = computeDragPos(-100, -100, 0, 0, 1280, 800)
    expect(pos.right).toBe(1280 - 60)
    expect(pos.bottom).toBe(800 - 60)
  })
})

describe('dragMovedEnough', () => {
  it('false below threshold, false exactly at threshold, true above', () => {
    expect(dragMovedEnough(0, 0, 3, 0)).toBe(false)
    expect(dragMovedEnough(0, 0, 4, 0)).toBe(false) // строго >
    expect(dragMovedEnough(0, 0, 5, 0)).toBe(true)
  })

  it('uses euclidean distance', () => {
    expect(dragMovedEnough(0, 0, 3, 4)).toBe(true) // 5 > 4
    expect(dragMovedEnough(10, 10, 12, 12)).toBe(false) // ~2.83
  })

  it('custom threshold is respected', () => {
    expect(dragMovedEnough(0, 0, 3, 0, 2)).toBe(true)
    expect(dragMovedEnough(0, 0, 3, 0, 10)).toBe(false)
  })
})

describe('storage roundtrip', () => {
  it('saves and loads back', () => {
    const msgs = [u('hi'), a('hello')]
    saveChatHistory(msgs, 'u1')
    expect(loadChatHistory('u1')).toEqual(msgs)
  })

  it('keeps only last MAX_MESSAGES', () => {
    const msgs = Array.from({ length: MAX_MESSAGES + 5 }, (_, i) => u(`m${i}`))
    saveChatHistory(msgs, 'u1')
    const loaded = loadChatHistory('u1')
    expect(loaded).toHaveLength(MAX_MESSAGES)
    expect(loaded).toEqual(msgs.slice(-MAX_MESSAGES))
  })

  it('broken JSON returns []', () => {
    localStorage.setItem(storageKeyFor('broken'), '{oops, not json')
    expect(loadChatHistory('broken')).toEqual([])
  })

  it('non-array JSON returns []', () => {
    localStorage.setItem(storageKeyFor('str'), JSON.stringify('just a string'))
    expect(loadChatHistory('str')).toEqual([])
  })

  it('filters out invalid entries', () => {
    localStorage.setItem(
      storageKeyFor('mix'),
      JSON.stringify([u('ok'), { role: 'system', content: 'x' }, { role: 'user' }, null, 42]),
    )
    expect(loadChatHistory('mix')).toEqual([u('ok')])
  })

  it('missing key returns []', () => {
    expect(loadChatHistory('nobody')).toEqual([])
  })
})
