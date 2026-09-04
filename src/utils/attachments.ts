/** Вложения чата: фото (vision) + текстовые файлы (CSV/TXT/MD). Без новых deps. */

export const MAX_FILE_MB = 10
export const MAX_FILES_PER_MESSAGE = 3
/** Текстовый контекст режем, чтобы не раздувать промпт и историю. */
export const MAX_TEXT_CHARS = 12_000
/** Фото жмём до этой стороны — хватает для чеков, экономит трафик/токены. */
export const MAX_IMAGE_SIDE = 1568

export interface PendingAttachment {
  name: string
  kind: 'image' | 'text'
  /** image: сжатый dataURL (jpeg); text: сырой текст */
  payload: string
  /** image: objectURL для превью (локально, не персистится) */
  objectUrl?: string
}

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']
const TEXT_EXT = ['csv', 'txt', 'md', 'tsv', 'log']
/** HEIC/HEIF с айфонов браузеры не декодируют (превью/сжатие невозможно) */
const HEIC_EXT = ['heic', 'heif']

export function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

export function classifyFile(name: string, mime: string): 'image' | 'text' | null {
  if (mime.startsWith('image/') || IMAGE_EXT.includes(extOf(name))) return 'image'
  if (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    TEXT_EXT.includes(extOf(name))
  ) return 'text'
  return null
}

export function validateFiles(files: File[]): { ok: boolean; errorRu: string; errorEn: string } {
  const bad = (ru: string, en: string) => ({ ok: false, errorRu: ru, errorEn: en })
  if (files.length > MAX_FILES_PER_MESSAGE)
    return bad(
      `Максимум ${MAX_FILES_PER_MESSAGE} файла за раз`,
      `Max ${MAX_FILES_PER_MESSAGE} files at once`,
    )
  for (const f of files) {
    if (f.size > MAX_FILE_MB * 1024 * 1024)
      return bad(`«${f.name}» больше ${MAX_FILE_MB} МБ`, `“${f.name}” exceeds ${MAX_FILE_MB} MB`)
    if (HEIC_EXT.includes(extOf(f.name)))
      return bad(
        `«${f.name}» в формате HEIC — браузер его не открывает. Пришли JPEG/PNG или скриншот чека`,
        `“${f.name}” is HEIC — browsers can’t open it. Send JPEG/PNG or a screenshot instead`,
      )
    if (!classifyFile(f.name, f.type))
      return bad(
        `«${f.name}»: пока умею фото и CSV/текст. PDF и Excel — следующим шагом`,
        `“${f.name}”: I read photos and CSV/text so far. PDF and Excel are next`,
      )
  }
  return { ok: true, errorRu: '', errorEn: '' }
}

/** Сжать фото через canvas до JPEG. При неудаче — вернуть null (caller решит). */
export function compressImage(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        try {
          const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height))
          const w = Math.max(1, Math.round(img.width * scale))
          const h = Math.max(1, Math.round(img.height * scale))
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            URL.revokeObjectURL(url)
            resolve(null)
            return
          }
          ctx.drawImage(img, 0, 0, w, h)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
          URL.revokeObjectURL(url)
          resolve(dataUrl)
        } catch {
          URL.revokeObjectURL(url)
          resolve(null)
        }
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }
      img.src = url
    } catch {
      resolve(null)
    }
  })
}

/** Прочитать файл как dataURL (fallback, если canvas-сжатие не сработало). */
function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result ?? ''))
    r.onerror = () => reject(r.error)
    r.readAsText(file)
  })
}

/** Подготовить вложения к отправке: фото сжать, текст обрезать. */
export async function prepareAttachments(files: File[]): Promise<PendingAttachment[]> {
  const out: PendingAttachment[] = []
  for (const f of files) {
    const kind = classifyFile(f.name, f.type)
    if (!kind) continue
    if (kind === 'image') {
      const compressed = await compressImage(f)
      const payload = compressed ?? (await readAsDataURL(f))
      let objectUrl: string | undefined
      try {
        objectUrl = URL.createObjectURL(f)
      } catch { /* ignore */ }
      out.push({ name: f.name, kind, payload, objectUrl })
    } else {
      const raw = await readAsText(f)
      out.push({ name: f.name, kind, payload: raw.slice(0, MAX_TEXT_CHARS) })
    }
  }
  return out
}

/** Текстовый блок для истории/БД (без base64 — чтобы не раздувать). */
export function attachmentHistoryBlock(a: PendingAttachment): string {
  return a.kind === 'image' ? `[фото: ${a.name}]` : `[файл ${a.name}]:\n${a.payload}`
}

const PHOTO_MARKER = /^\[фото:\s*(.+?)\]\s*$/
const FILE_MARKER = /^\[файл\s+(.+?)\]:\s*$/
const PLACEHOLDER_RU = 'Разбери вложения'
const PLACEHOLDER_EN = 'Review the attachments'

export interface DisplayParts {
  /** Человеческий текст (без технических блоков вложений) */
  text: string
  photos: string[]
  files: string[]
}

/**
 * Разбирает сообщение для ПОКАЗА: вложения (они всегда дописаны в конец
 * через attachmentHistoryBlock) вырезаются из текста и отдаются чипами.
 * В state/БД полный текст остаётся — LLM не теряет контекст.
 */
export function parseDisplay(content: string): DisplayParts {
  const lines = content.split('\n')
  let cut = lines.length
  const photos: string[] = []
  const files: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const ph = lines[i].match(PHOTO_MARKER)
    const fl = lines[i].match(FILE_MARKER)
    if (ph || fl) {
      // Текст заканчивается на ПЕРВОМ маркере (cut ставим один раз)
      if (cut === lines.length) cut = i
      if (ph) photos.push(ph[1])
      if (fl) files.push(fl[1])
    } else if (cut < lines.length) {
      // Внутри зоны вложений: собираем имена, текст файлов игнорим
      const ph2 = lines[i].match(PHOTO_MARKER)
      const fl2 = lines[i].match(FILE_MARKER)
      if (ph2) photos.push(ph2[1])
      if (fl2) files.push(fl2[1])
    }
  }
  let text = lines.slice(0, cut).join('\n').trim()
  if (text === PLACEHOLDER_RU || text === PLACEHOLDER_EN) text = ''
  return { text, photos, files }
}
