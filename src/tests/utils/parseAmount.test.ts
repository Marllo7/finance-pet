import { describe, it, expect } from 'vitest'
import { parseAmount } from '../../utils/parseAmount'

describe('parseAmount', () => {
  it('parses plain integers', () => {
    expect(parseAmount('200')).toBe(200)
  })

  it('parses decimal with dot', () => {
    expect(parseAmount('12.5')).toBe(12.5)
  })

  it('parses space + comma decimals', () => {
    expect(parseAmount('1 000,50')).toBe(1000.5)
    expect(parseAmount('1 000')).toBe(1000)
  })

  it('treats commas as thousands when both comma and dot present', () => {
    expect(parseAmount('1,000.50')).toBe(1000.5)
  })

  it('returns null for invalid or non-positive input', () => {
    expect(parseAmount('-5')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('0')).toBeNull()
  })

  it('handles nbsp and both separators with last-wins rule', () => {
    expect(parseAmount('1' + ' ' + '000,50')).toBe(1000.5)
    expect(parseAmount('1.000,50')).toBe(1000.5)
    expect(parseAmount('12,34,56')).toBe(1234.56)
  })

  it('rejects exponents and hex', () => {
    expect(parseAmount('1e3')).toBeNull()
    expect(parseAmount('0x10')).toBeNull()
  })

  it('parses leading-dot/comma decimals and rejects zero', () => {
    expect(parseAmount('.5')).toBe(0.5)
    expect(parseAmount(',5')).toBe(0.5)
    expect(parseAmount('0.00')).toBeNull()
  })
})
