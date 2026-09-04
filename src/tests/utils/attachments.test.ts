import { describe, it, expect } from 'vitest'
import { classifyFile, extOf, parseDisplay, validateFiles } from '../../utils/attachments'

function file(name: string, size: number, type: string): File {
  const blob = new Blob([new Uint8Array(size)], { type })
  return new File([blob], name, { type })
}

describe('attachments classify', () => {
  it('detects images by mime and extension', () => {
    expect(classifyFile('check.jpg', 'image/jpeg')).toBe('image')
    expect(classifyFile('check', 'image/png')).toBe('image')
  })
  it('detects text formats', () => {
    expect(classifyFile('stmt.csv', 'text/csv')).toBe('text')
    expect(classifyFile('notes.txt', '')).toBe('text')
  })
  it('rejects pdf/excel for now', () => {
    expect(classifyFile('doc.pdf', 'application/pdf')).toBeNull()
    expect(classifyFile('book.xlsx', 'application/vnd.ms-excel')).toBeNull()
  })
  it('extOf handles missing extension', () => {
    expect(extOf('noext')).toBe('')
    expect(extOf('A.JPG')).toBe('jpg')
  })
})

describe('attachments validate', () => {
  it('rejects more than 3 files', () => {
    const list = [file('a.jpg', 10, 'image/jpeg'), file('b.jpg', 10, 'image/jpeg'), file('c.jpg', 10, 'image/jpeg'), file('d.jpg', 10, 'image/jpeg')]
    expect(validateFiles(list).ok).toBe(false)
  })
  it('rejects oversize', () => {
    expect(validateFiles([file('big.jpg', 11 * 1024 * 1024, 'image/jpeg')]).ok).toBe(false)
  })
  it('accepts small photo + csv', () => {
    expect(validateFiles([file('a.jpg', 100, 'image/jpeg'), file('s.csv', 100, 'text/csv')]).ok).toBe(true)
  })
  it('rejects heic with a helpful message', () => {
    const v = validateFiles([file('IMG_1969.heic', 100, 'image/heic')])
    expect(v.ok).toBe(false)
    expect(v.errorRu).toMatch(/HEIC/)
  })
})

describe('parseDisplay', () => {
  it('keeps plain text untouched', () => {
    expect(parseDisplay('привет')).toEqual({ text: 'привет', photos: [], files: [] })
  })
  it('strips photo markers and placeholder', () => {
    const d = parseDisplay('Разбери вложения\n[фото: IMG_1.jpg]')
    expect(d).toEqual({ text: '', photos: ['IMG_1.jpg'], files: [] })
  })
  it('keeps user text and collects names', () => {
    const d = parseDisplay('кофе 250\n[фото: check.jpg]\n[файл stmt.csv]:\namount,date\n100,2026-09-01')
    expect(d.text).toBe('кофе 250')
    expect(d.photos).toEqual(['check.jpg'])
    expect(d.files).toEqual(['stmt.csv'])
  })
})
