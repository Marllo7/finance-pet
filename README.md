# Finance Pet

Веб-приложение для учёта личных финансов с виртуальным питомцем-помощником. Mobile-first, дружелюбный дизайн, не банковский.

### Стек

React 19 + TypeScript + Vite + Supabase + Tailwind CSS. Иконки — `lucide-react`. Тесты — Vitest + Testing Library.

### Команды

```bash
npm run dev       # локальная разработка
npm run build     # production-сборка
npm run test:run  # запуск тестов (Vitest, один проход)
```

### Переменные окружения

Скопируйте `.env.example` в `.env` и заполните:

- `VITE_SUPABASE_URL` — URL проекта Supabase
- `VITE_SUPABASE_ANON_KEY` — публичный anon-ключ
- `VITE_SUPABASE_REF` — ref проекта (для Edge Functions / деплоя)

### Деплой (Cloudflare Pages)

1. `npm run build` — артефакты в `dist/`.
2. Подключите репозиторий в Cloudflare Pages, build command `npm run build`, output `dist`.
3. Пропишите env-переменные `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` в настройках Pages.

### Edge Function `chat-proxy`

```bash
supabase functions deploy chat-proxy --project-ref ngtwzexyduomyaongegd
```

Схема БД и RLS-политики — в `supabase/schema.sql`, харднинг — в `supabase/migration_rls_hardening.sql`.
