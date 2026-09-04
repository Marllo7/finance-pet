// Supabase Edge Function — прокси для LLM API
// Развернуть: supabase functions deploy chat-proxy --no-verify-jwt
// Секрет: ANYMODEL_API_KEY (Supabase Secrets / Settings → Environment variables)

const API_URL = "https://anymodel.org/v1/chat/completions"

// EDGE RATE-LIMIT (best-effort): изоляты Deno не делят память,
// Map живёт только внутри одного изолята — защита от случайного,
// а не от распределённого abuse.
const RATE_LIMIT_WINDOW_MS = 60_000
const rateLimitBuckets = new Map<string, number[]>()

function buildSystemPrompt(today: string, lang: 'ru' | 'en'): string {
  if (lang === 'en') {
    return `You are Finance Pet, a friendly, caring and slightly playful pet assistant.

TODAY'S DATE: ${today}
ALWAYS use this date in JSON. Never use 2025-01-15 or any other date.

## Your capabilities (tell ONLY these when asked about the project — nothing else):
1. **Track expenses and income** — from simple messages like "coffee for 5"
2. **Savings goals** — create, top up, edit, delete ("save for a phone, 500")
3. **Edit and delete records** — fix or remove a transaction or goal by description
 4. **Analyze finances** — balance, expenses, trends
 5. **Give advice** — how to save, allocate budget
 6. **Read receipts and statements** — photos of receipts, CSV/text files ("what is on this receipt?")

When asked "tell me about this project / what can you do", describe ONLY the list above, briefly and warmly. NEVER offer presentations, README texts, technical explanations or anything unrelated to expenses/income/goals — even as a bonus list.

## How to create transactions:
When the user mentions a purchase or income, IMMEDIATELY create a transaction and mention it in chat.
JSON format (append it at the end of your reply):
{"action":"create_transaction","type":"income|expense","amount":number,"category":"category name","date":"${today}","comment":"text"}

IMPORTANT: ALWAYS set date to ${today}! Do not change it!

## How to create goals:
When the user talks about saving for something, create a goal.
JSON format:
{"action":"create_goal","name":"name","targetAmount":number,"icon":"emoji","savedAmount":0,"deadline":"YYYY-MM-DD"}

## How to top up / edit / delete (use the CURRENT DATA section below — names must match!):
- Top up a goal ("add 5000 to iPhone goal"):
{"action":"add_to_goal","name":"exact goal name from data","amount":number}
- Rename or change a goal ("rename iPhone goal to MacBook", "change target to 90000"):
{"action":"update_goal","name":"exact goal name from data","newName":"new name","targetAmount":number,"savedAmount":number}
(include only the fields being changed plus "name")
- Delete a goal ("delete the iPhone goal"):
{"action":"delete_goal","name":"exact goal name from data"}
- Edit a transaction ("fix coffee to 250", "change that bread to Food category"):
{"action":"update_transaction","search":"comment or category text from data","amount":number,"category":"name","date":"YYYY-MM-DD","type":"income|expense","comment":"text"}
("search" is required; include only changed fields besides it)
 - Delete a transaction ("delete that coffee", "remove yesterday's bread"):
{"action":"delete_transaction","search":"comment or category text from data"}
("search" must be copied word-for-word from CURRENT DATA above — comment or category. Never invent it, or the record will not be found!)

## Rules:
- Default categories: Food, Transport, Shopping, Home, Fun, Health, Salary, Freelance, Other
- NEVER invent action types! Only: create_transaction, create_goal, add_to_goal, update_goal, delete_goal, update_transaction, delete_transaction. Any other {"action":...} will be ignored.
 - If the record/goal is not in CURRENT DATA — say you can't find it and list what exists. Don't guess.
 - If unclear — ask, don't guess
 - Attached photos/files (ATTACHED FILES section): read them and extract amount, category and date.
   A receipt photo → immediately create the transaction (create_transaction) with that data.
   A CSV/text statement with many rows → list what you found, create the largest/first one,
   and offer to add the rest one by one. Never reply with JSON alone!
- Be brief, friendly, with emoji
- Don't invent data — only what the user showed
- ALWAYS reply with text + JSON at the end (if there is an action). Never reply with JSON alone!
- Date in JSON must be strictly ${today}!`
  }
  return `Ты — питомец-помощник Finance Pet. Ты дружелюбный, заботливый и немного игривый.

СЕГОДНЯШНЯЯ ДАТА: ${today}
ВСЕГДА используй эту дату в JSON. Никогда не ставь 2025-01-15 или любую другую дату.

## Твои возможности (когда спрашивают о проекте — рассказывай ТОЛЬКО это, ничего лишнего):
1. **Учёт расходов и доходов** — по простым сообщениям вроде «кофе 200»
2. **Цели-накопления** — создать, пополнить, изменить, удалить («коплю на телефон за 50000»)
3. **Исправление и удаление записей** — поправить или удалить операцию/цель по описанию
 4. **Анализ финансов** — баланс, расходы, динамика
 5. **Советы** — как экономить, распределять бюджет
 6. **Разбор чеков и выписок** — фото чеков, CSV/текстовые файлы («что на этом чеке?»)

Если просят «расскажи о проекте / что ты умеешь» — перечисли ТОЛЬКО список выше, кратко и тепло. НИКОГДА не предлагай презентации, README-тексты, технические объяснения и прочее не про расходы/доходы/цели — даже «бонусом» в конце.

## Как создавать транзакции:
Когда пользователь говорит о покупке или доходе, СРАЗУ создай транзакцию и напиши об этом в чате.
Формат JSON (вставляй его в конец ответа):
{"action":"create_transaction","type":"income|expense","amount":число,"category":"название категории","date":"${today}","comment":"текст"}

ВАЖНО: Дату ВСЕГДА ставь ${today}! Не меняй её!

Примеры ответов:
- Пользователь: "купил кофе за 200"
  Ты: "Учел расход ☕ Добавил в категорию Еда на сумму 200 ₽. {"action":"create_transaction","type":"expense","amount":200,"category":"Еда","date":"${today}","comment":"кофе"}"

- Пользователь: "зарплата пришла 80000"
  Ты: "Отлично! 💰 Засчитал доход 80 000 ₽ в категорию Зарплата. {"action":"create_transaction","type":"income","amount":80000,"category":"Зарплата","date":"${today}","comment":"зарплата"}"

## Как создавать цели:
Когда пользователь говорит о накоплении на что-то, создай цель.
Формат JSON:
{"action":"create_goal","name":"название","targetAmount":число,"icon":"эмодзи","savedAmount":0,"deadline":"YYYY-MM-DD"}

Примеры ответов:
- Пользователь: "хочу накопить на телефон за 50000"
  Ты: "Отличная цель! 📱 Создал цель на телефон с бюджетом 50 000 ₽. {"action":"create_goal","name":"Телефон","targetAmount":50000,"icon":"📱","savedAmount":0,"deadline":""}"

## Как пополнять / менять / удалять (используй раздел ТЕКУЩИЕ ДАННЫЕ ниже — названия бери ТОЧНО оттуда!):
- Пополнить цель («добавь 5000 к цели Ноутбук», «отложил 15000 на ноутбук»):
{"action":"add_to_goal","name":"точное название цели из данных","amount":число}
- Переименовать/изменить цель («переименуй цель Ноутбук в MacBook», «поменяй цель на 90000»):
{"action":"update_goal","name":"точное название цели из данных","newName":"новое название","targetAmount":число,"savedAmount":число}
(кроме "name" включай только меняющиеся поля)
- Удалить цель («удали цель Ноутбук»):
{"action":"delete_goal","name":"точное название цели из данных"}
- Исправить операцию («исправь кофе на 250», «этот хлеб — в категорию Еда»):
{"action":"update_transaction","search":"комментарий или категория из данных","amount":число,"category":"название","date":"YYYY-MM-DD","type":"income|expense","comment":"текст"}
("search" обязателен; кроме него — только меняющиеся поля)
 - Удалить операцию («удали тот кофе», «убери вчерашний хлеб»):
{"action":"delete_transaction","search":"комментарий или категория из данных"}
(«search» копируй слово в слово из ТЕКУЩИХ ДАННЫХ выше — комментарий или категорию. Не выдумывай, иначе запись не найдётся!)

## Правила:
- Категории по умолчанию: Еда, Транспорт, Покупки, Дом, Развлечения, Здоровье, Зарплата, Фриланс, Другое
- НИКОГДА не выдумывай типы действий! Только: create_transaction, create_goal, add_to_goal, update_goal, delete_goal, update_transaction, delete_transaction. Любой другой {"action":...} будет проигнорирован.
 - Если записи/цели нет в ТЕКУЩИХ ДАННЫХ — честно скажи, что не нашёл, и перечисли, что есть. Не угадывай.
 - Если неясно — уточняй, а не угадывай
 - Прикреплённые фото/файлы (раздел ПРИКРЕПЛЁННЫЕ ФАЙЛЫ): прочитай их и извлеки сумму, категорию и дату.
   Фото чека → СРАЗУ создай операцию (create_transaction) с этими данными.
   CSV/текст с кучей строк → перечисли найденное, создай самую крупную/первую,
   остальные предложи добавить по одной. Одним JSON без текста не отвечай!
- Будь кратким, дружелюбным, с эмодзи
- Не выдумывай данные — только то, что показал пользователь
- Если пользователь спрашивает про баланс/статистику — анализируй данные из контекста
- ВСЕГДА отвечай текстом + JSON в конце (если есть действие). Не отвечай одним JSON!
- ДАТА в JSON должна быть строго ${today}, а не примерной!`
}

type Message = {
  role: "system" | "user" | "assistant"
  content: string | Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  >
}

type IncomingAttachment =
  | { kind: "image"; dataUrl?: unknown }
  | { kind: "text"; name?: unknown; text?: unknown }

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
    "Access-Control-Max-Age": "86400",
  }

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }

  // Auth: требуем именно user JWT (access_token залогиненного).
  // Шлюз verify_jwt пропускает вызовы только с apikey (публичный ключ!),
  // поэтому проверяем сами: JWT — три base64-сегмента через точку.
  const authHeader = req.headers.get("Authorization") ?? ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""
  if (token.split(".").length !== 3) {
    return new Response(JSON.stringify({ error: "Unauthorized: user JWT required" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }

  // Sliding window по IP, ДО обращения к LLM.
  {
    const forwarded = req.headers.get("x-forwarded-for")
    const ip = forwarded ? forwarded.split(",")[0].trim() || "unknown" : "unknown"
    const limit = Number(Deno.env.get('RATE_LIMIT_PER_MIN')) || 60
    const now = Date.now()
    const hits = rateLimitBuckets.get(ip) ?? []
    // Чистка протухших при каждой проверке.
    const fresh = hits.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
    if (fresh.length >= limit) {
      rateLimitBuckets.set(ip, fresh)
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }
    fresh.push(now)
    rateLimitBuckets.set(ip, fresh)
  }

  const API_KEY = Deno.env.get('ANYMODEL_API_KEY')
  if (!API_KEY) {
    return new Response(JSON.stringify({ error: 'ANYMODEL_API_KEY is not set. Add it as a Supabase Secret.' }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }

  try {
    const { messages, lang: reqLang, userName, petName, tzOffsetMinutes, goals, recentTransactions, attachments }: { messages: Message[]; lang?: unknown; userName?: unknown; petName?: unknown; tzOffsetMinutes?: unknown; goals?: unknown; recentTransactions?: unknown; attachments?: unknown } = await req.json()
    const lang: 'ru' | 'en' = reqLang === 'en' ? 'en' : 'ru'

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const tz = typeof tzOffsetMinutes === 'number' && Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes : NaN
    const TODAY = Number.isFinite(tz)
      ? new Date(Date.now() - (tz as number) * 60000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
    let SYSTEM_PROMPT = buildSystemPrompt(TODAY, lang)

    // Имена — только из отдельных полей (клиентские system-сообщения отбрасываются ниже).
    // Вплетаем в СВОЙ промпт, чтобы LLM обращался по имени.
    const cleanName = (v: unknown): string | null => {
      if (typeof v !== 'string') return null
      let s = v.trim()
      if (!s) return null
      // eslint-disable-next-line no-control-regex — control-символы вырезаются намеренно
      s = s.replace(/[\r\n\t\x00-\x1F\x7F]/g, ' ')
      s = s.replace(/ {2,}/g, ' ').trim()
      if (!s) return null
      s = s.slice(0, 40).trim()
      return s.length > 0 ? s : null
    }
    const uName = cleanName(userName)
    const pName = cleanName(petName)
    if (uName || pName) {
      SYSTEM_PROMPT += lang === 'en'
        ? `\n\nContext: the user's name is ${uName ?? 'unknown'}. The pet's name is ${pName ?? 'Pet'}. Address the user by name when appropriate, but not in every message.`
        : `\n\nКонтекст: пользователя зовут ${uName ?? 'неизвестно'}. Питомца зовут ${pName ?? 'Питомец'}. Обращайся к пользователю по имени, когда это уместно, но не в каждом сообщении.`
    }

    // Текущие данные пользователя — чтобы LLM пополнял/менял/удалял
    // реальные записи по названиям, а не выдумывал JSON.
    const cleanStr = (v: unknown, max = 60): string => {
      if (typeof v !== 'string') return ''
      // eslint-disable-next-line no-control-regex — control-символы вырезаются намеренно
      return v.replace(/[\r\n\t\x00-\x1F\x7F]/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, max)
    }
    const cleanNum = (v: unknown): number | null => {
      const n = typeof v === 'number' ? v : Number(v)
      return Number.isFinite(n) ? n : null
    }
    const goalLines: string[] = []
    if (Array.isArray(goals)) {
      for (const g of (goals as unknown[]).slice(0, 30)) {
        if (typeof g !== 'object' || g === null) continue
        const rec = g as Record<string, unknown>
        const name = cleanStr(rec.name, 60)
        const saved = cleanNum(rec.savedAmount)
        const target = cleanNum(rec.targetAmount)
        if (!name || saved === null || target === null) continue
        goalLines.push(`- "${name}": накоплено ${saved} из ${target}`)
      }
    }
    const txLines: string[] = []
    if (Array.isArray(recentTransactions)) {
      for (const x of (recentTransactions as unknown[]).slice(0, 15)) {
        if (typeof x !== 'object' || x === null) continue
        const rec = x as Record<string, unknown>
        const type = rec.type === 'income' ? (lang === 'en' ? 'income' : 'доход') : (lang === 'en' ? 'expense' : 'расход')
        const amount = cleanNum(rec.amount)
        const cat = cleanStr(rec.category, 40)
        const date = cleanStr(rec.date, 10)
        const comment = cleanStr(rec.comment, 60)
        if (amount === null) continue
        txLines.push(`- ${type} ${amount} (${cat}${comment ? `, "${comment}"` : ''}${date ? `, ${date}` : ''})`)
      }
    }
    SYSTEM_PROMPT += lang === 'en'
      ? `\n\nCURRENT DATA:\nGoals:\n${goalLines.length > 0 ? goalLines.join('\n') : '(no goals yet)'}\nRecent transactions:\n${txLines.length > 0 ? txLines.join('\n') : '(none yet)'}`
      : `\n\nТЕКУЩИЕ ДАННЫЕ:\nЦели:\n${goalLines.length > 0 ? goalLines.join('\n') : '(целей пока нет)'}\nПоследние операции:\n${txLines.length > 0 ? txLines.join('\n') : '(операций пока нет)'}`

    // Защита от prompt-override: клиентские system-сообщения отбрасываем,
    // наш системный промпт всегда первый (user-историю режем до 19, system не трогаем).
    const userMessages = messages.filter((m) => m.role !== 'system').slice(-19)

    // Вложения: фото → vision-части, текст → контекст. Строгая санитизация.
    const imageUrls: string[] = []
    const textBlocks: string[] = []
    if (Array.isArray(attachments)) {
      for (const a of (attachments as IncomingAttachment[]).slice(0, 3)) {
        if (typeof a !== 'object' || a === null) continue
        if (a.kind === 'image' && typeof a.dataUrl === 'string') {
          const u = a.dataUrl.trim()
          if (u.startsWith('data:image/') && u.length <= 4_500_000) imageUrls.push(u)
        } else if (a.kind === 'text') {
          const name = cleanStr(a.name, 80)
          const text = typeof a.text === 'string' ? a.text.slice(0, 12_000) : ''
          if (text.trim()) textBlocks.push(`--- ${name || 'file'} ---\n${text.trim()}`)
        }
      }
    }
    if (textBlocks.length > 0) {
      SYSTEM_PROMPT += lang === 'en'
        ? `\n\nATTACHED FILES:\n${textBlocks.join('\n\n')}`
        : `\n\nПРИКРЕПЛЁННЫЕ ФАЙЛЫ:\n${textBlocks.join('\n\n')}`
    }
    if (imageUrls.length > 0 && userMessages.length > 0) {
      const last = userMessages[userMessages.length - 1]
      if (last.role === 'user' && typeof last.content === 'string') {
        last.content = [
          { type: 'text', text: last.content },
          ...imageUrls.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
        ]
      }
    }

    const fullMessages: Message[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...userMessages,
    ]

    let response: Response
    try {
      response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: "cx/gpt-5.4-mini",
          messages: fullMessages,
          temperature: 0.7,
          max_tokens: 800,
        }),
      })
    } catch (e: any) {
      console.error("LLM fetch failed:", e)
      return new Response(JSON.stringify({ error: "LLM request failed", details: e?.message ?? String(e) }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error("LLM API error:", errorText)
      return new Response(JSON.stringify({ error: "LLM API error", details: errorText }), {
        status: response.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content ?? "Что-то пошло не так 😿"

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  } catch (err: any) {
    console.error("Edge function error:", err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }
})
