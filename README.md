# Reflectin

Telegram-бот + Mini App для автономного ведения Telegram-каналов: генерация
контента, черновики, контент-план, задачи-exeкутции, аналитика и тарифы.

## Этапы

- **Этап 0 — Фундамент**: хостинг Supabase (Postgres + Edge Functions),
  webhook-бот на grammY, авторизация Mini App по initData, модель данных,
  роутинг.
- **Этап 1 — Генерация контента**: генератор «пост из идеи» по 4 рубрикам,
  черновики, квоты, Mini App (дизайн v4: монохромный фон, логотип `#`,
  стартовый экран с лесенкой табов, акцент #b4ff5a).

План: `docs/superpowers/plans/2026-08-20-stage-0-1.md`

## Локальная разработка

Требуется Deno 2+ и Node 20+.

```powershell
# тесты edge-функций (папка supabase)
cd supabase
deno test

# фронтенд (папка webapp)
cd webapp
npm install
npm run dev
```

## Конфигурация

Скопируйте `.env.example` в `.env` в корне supabase (`supabase/.env`) и
заполните секреты. Скрипты, мета-скрипты и функции читают его.

## Деплой

```powershell
cd supabase
supabase link --project-ref <ref>
supabase db push                  # миграция
supabase functions deploy telegram-bot api --no-verify-jwt
# затем настроить webhook и кнопку меню (см. scripts/)
```