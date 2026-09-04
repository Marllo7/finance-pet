// Склонение русских имён (родительный падеж): мужских и женских
// Максим → Максима, Анна → Анны, Мария → Марии и т.д.
// Регистр первой буквы входного имени сохраняется в результате.

const commonNames: Record<string, string> = {
  'maxim': 'максима',
  'максим': 'максима',
  'дмитрий': 'дмитрия',
  'александр': 'александра',
  'иван': 'ивана',
  'сергей': 'сергея',
  'андрей': 'андрея',
  'алексей': 'алексея',
  'николай': 'николая',
  'владимир': 'владимира',
  'михаил': 'михаила',
  'артём': 'артёма',
  'кирилл': 'кирилла',
  'денис': 'дениса',
  'роман': 'романа',
  'илья': 'ильи',
  'олег': 'олега',
  'виктор': 'виктора',
  'павел': 'павла',
  'антон': 'антона',
  'игорь': 'игоря',
  'константин': 'константина',
  'евгений': 'евгения',
  'юрий': 'юрия',
  'никита': 'никиты',
  'егор': 'егора',
  'тимур': 'тимура',
  'руслан': 'руслана',
  'станислав': 'станислава',
  'леонид': 'леонида',
  'петр': 'петра',
  'богдан': 'богдана',
  'валерий': 'валерия',
  'геннадий': 'геннадия',
  // Женские имена (родительный падеж)
  'анна': 'анны',
  'мария': 'марии',
  'ольга': 'ольги',
  'елена': 'елены',
  'наталья': 'натальи',
  'наталия': 'наталии',
  'любовь': 'любови',
  'адель': 'адели',
  'рахиль': 'рахили',
  'эсфирь': 'эсфири',
  'эстер': 'эстер',
}

function matchCase(source: string, result: string): string {
  if (!source || !result) return result
  const isAllUpper = source.length > 1 && source === source.toUpperCase() && /[а-яёa-z]/i.test(source)
  const isFirstUpper = source[0] === source[0].toUpperCase() && source.slice(1) === source.slice(1).toLowerCase()
  if (isAllUpper) return result.toUpperCase()
  if (isFirstUpper) return result.charAt(0).toUpperCase() + result.slice(1)
  return result
}

export function declineName(name: string | null, lang: string): string {
  if (!name) return lang === 'ru' ? 'неизвестно' : 'unknown'
  const trimmed = name.trim()
  if (!trimmed) return lang === 'ru' ? 'неизвестно' : 'unknown'

  // Для английского — возвращаем как есть
  if (lang !== 'ru') return trimmed

  const lower = trimmed.toLowerCase()

  // Склонённая форма (в нижнем регистре)
  let declined: string | null = commonNames[lower] ?? null

  if (!declined) {
    // Общие правила для женских имён (проверяются первыми —
    // для окончаний -а/-я результат совпадает и для мужских имён типа Никита/Илья)
    // Имя на -я → -и (Мария → Марии)
    if (lower.endsWith('я')) declined = lower.slice(0, -1) + 'и'
    // Имя на -а → -ы, после г/к/х/ж/ш/ч/щ → -и (Анна → Анны, Ольга → Ольги)
    else if (lower.endsWith('а')) {
      const prev = lower.length >= 2 ? lower[lower.length - 2] : ''
      declined = 'гкхжшчщ'.includes(prev)
        ? lower.slice(0, -1) + 'и'
        : lower.slice(0, -1) + 'ы'
    }
    // Имя на -ь женского рода (3-е склонение) → -и (Любовь → Любови).
    // Мужские имена на -ь (Игорь → Игоря) обрабатываются ниже:
    // эвристика по типично женским финалам на -бь/-вь/-фь/-пь/-мь/-овь/-евь.
    else if (lower.endsWith('ь') && /(овь|евь|ёвь|бь|вь|фь|пь|мь)$/.test(lower)) {
      declined = lower.slice(0, -1) + 'и'
    }
    // Общие правила для мужских имён
    // Имя на -ий → -ия (Дмитрий → Дмитрия)
    else if (lower.endsWith('ий')) declined = lower.slice(0, -2) + 'ия'
    // Имя на -ей → -я (Сергей → Сергея)
    else if (lower.endsWith('ей')) declined = lower.slice(0, -2) + 'я'
    // Имя на -ь → -я (Игорь → Игоря)
    else if (lower.endsWith('ь')) declined = lower.slice(0, -1) + 'я'
    // Имя на согласную → +а (Максим → Максима)
    else if (/[^аеёиоуыэюя]$/.test(lower)) declined = lower + 'а'
    else declined = lower
  }

  return matchCase(trimmed, declined)
}

