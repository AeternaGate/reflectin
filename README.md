# Reflectin

Telegram-бот + Mini App для контент-инжиниринга каналов: анализ статистики, механики удержания, модель-драйв, авто-ротация и мониторинг каналов.

## Особенности

- **Статистика и аналитика** — агрегация и анализ метрик каналов.
- **Upsell-цепочки** — работа с механиками удержания аудитории.
- **Mini App** — интерфейс в Telegram (v4: голосовые сообщения, разметка `#`, многоуровневое меню, фирменный акцент `#b4ff5a`).
- **Авто-ротация и мониторинг** каналов.

## Стек

- **Supabase** — Postgres + Edge Functions (`api`, `telegram-bot`, `scheduler`).
- **grammY** — Telegram Bot API.
- **Mini App** — Vite + TypeScript (веб-интерфейс в `webapp/`).

## Требования

- Deno 2+ (для Edge Functions) и Node 20+ (для webapp).

## Локальная разработка

```powershell
# Тесты Edge Functions (из корня supabase)
cd supabase
deno test

# Мини-апп
cd webapp
npm install
npm run dev
```

## Конфигурация

Скопируйте `.env.example` в `.env`, а для Supabase — в `supabase/.env`, и заполните переменные. Убедитесь, что колонки таблиц и роли не противоречат друг другу.

## Деплой

```powershell
cd supabase
supabase link --project-ref <ref>
supabase db push                  # миграции
supabase functions deploy telegram-bot api --no-verify-jwt
# Дальше дёрните webhook через скрипты из scripts/
```
