# Reflectin — Дизайн-спецификация (Этапы 0–6)

Полный объём продукта: от фундамента (Supabase, webhook-бот, авторизация Mini App)
до генерации контента, автопостинга, модерации, трендов, мультиканальности,
AI-агентов и монетизации на Telegram Stars.

## Решения (согласовано с пользователем, уточнено 2026-08-20)

- Реализация поэтапно, этапы — из основного плана. Первые: **Этап 0** (фундамент) + **Этап 1** (генерация контента).
- **Хостинг**: Supabase — Postgres + Edge Functions (Deno) + переезд Bit.io.
  Webhook с первого дня; long-polling только в локальной разработке.
- **Бот**: grammY + Deno на edge-функции `telegram-bot` (webhook, проверка
  `x-telegram-bot-api-secret-token`).
- **Mini App**: Vite + React + TS + Tailwind, хостинг Vercel (free).
- **AI**: OpenRouter, free-модели, fallback-цепочка. Модели — через env
  `OPENROUTER_MODELS`, дефолтный ростер:
  `nvidia/nemotron-3-ultra-550b-a55b:free` → `inclusionai/ling-3.0-flash:free`
  → `openai/gpt-oss-20b:free` → `openrouter/free`.
- **Авторизация Mini App**: initData, HMAC-SHA256, ключ `"WebAppData"`,
  секрет = `BOT_TOKEN`, срок `auth_date` ≤ 24ч, constant-time сравнение hash.
  БД читается через service role (api = доверенная граница), Supabase Auth НЕ используется.
- **Квоты**: суточный лимит по тарифу (`planLimits(plan).quota`); free —
  `FREE_DAILY_QUOTA` env (дефолт 2), считается по `generation_log` за дату.
- **Голос бота**: без эмодзи, короткие абзацы, крючок первым делом.
  Рубрики: польза 40%, вовлечение 30%, продажи 20%, личное 10%.
- **Дизайн v4 (одобрен)**: монохромный тёмный фон (без зелёного подтона,
  #0b0b0d/#151518/#222227), акцент #b4ff5a, логотип — символ `#`,
  стартовый экран = «лесенка» табов (ступенчатый вертикальный сдвиг),
  квота = сегменты, карточки с левой цветной полосой по рубрике.
  Без эмодзи, без градиентов. Иконки — `@phosphor-icons/react`.
- **Фон Mini App — react-bits Beams**: библиотека `@react-bits/Beams-JS-CSS`
  (shadcn registry). `<Beams beamWidth={2} beamHeight={20} beamNumber={13}
  lightColor="#ffffff" speed={2} noiseIntensity={2} scale={0.15} rotation={0}/>`
  в обёртке 1080×1080 (absolute, центрировано), `pointer-events-none fixed
  inset-0 z-0`, контент поверх `z-10`. Лучи белые поверх монохромного фона —
  дизайн остаётся без цветных градиентов.
- **Монетизация (тарифы ТЗ)**: Free 2 канала/2 генерации/день, Starter
  **199★** (3 канала/10 генераций), Pro **499★** (5 каналов/50 генераций +
  AI-агенты + автомодерация + контент-план на 30 дней), Agency **999★**
  (10 каналов + командный доступ). Оплата — Telegram Stars. Блокировка
  добавления канала сверх лимита тарифа.
- **Аналитика/отчёты — ВЫПИЛЕНО**: Bot API не отдаёт просмотры/реакции
  канальных постов, поэтому метрики эффективности реализовать нельзя.
  Нет `analytics.ts`/`report.ts`/`alerts.ts`, экранов аналитики и отчётов,
  `/analytics` и `/report`; мониторинг конкурентов остался как RSS-тренды.
- **Тумблеры функций**: `channels.features jsonb default '{}'`; ключи
  `autoposting`, `moderation`, `autoreply`, `agents`, `trends`, `templates`;
  отсутствие ключа = включено (фолбэк). Вкл/выкл через экран «Настройки»
  в Mini App → `PATCH /channels/:id`. Проверяются в scheduler, боте и API.
- **Автопостинг**: планирование из контент-плана; публикация по
  `scheduled_at`; очередь авто-пополняется, когда осталась < 5 постов
  (fillTo=5); own считается только по `status='queued'`; приоритеты
  (срочное → выше); тихие часы `quiet_hours`; пост-час `post_hour`.
  Пополнение НЕ пишет в generation_log (квота — ручные/агентские генерации).
  Scheduler — pg_cron → `net.http_post` на edge-функцию `scheduler` каждые 5 минут.
- **Отпуск**: `vacation_from`/`vacation_to` на канале; во время отпуска
  публикуется готовый план, очередь НЕ пополняется.
- **Модерация/комментарии**: бот админ канала (назначается вручную юзером);
  обсуждение `chat.id < 0`; тональность (позитив/нейтрал/негатив), фильтр
  спама/ссылок; спам → `deleteMessage` + `restrictChatMember`; автоответы по
  базе знаний (`knowledge_base`), эскалация негатива/вопросов владельцу.
- **Мультиканальность**: до 10 каналов по тарифу (`planLimits(plan).channels`);
  одна стратегия на канал; командные роли owner > editor > moderator,
  роли в `channel_members`, владелец = создатель канала.
- **AI-агенты (Pro)**: pipeline ресёрчер → писатель → редактор; 1 выданный
  пост = 1 единица квоты (снимается за результат, а не за число LLM-вызовов).
- **Тренды**: RSS/новостные источники (`monitoring_channels` до 10) как инпут;
  извлечение повторяющихся тем; `/trends` в API — с учётом тумблера.
- **Шаблоны**: «Сохранить как шаблон» из черновика в Mini App
  (`templates`), применение через `applyTemplate` (плейсхолдеры `{key}`);
  стиль канала (`voice`, `max_posts_per_day`) входит в промпт генерации.

## Архитектура

```
supabase/
  functions/
    telegram-bot/    webhook: /start (webapp-кнопка), /gen, /fact, /tariffs, модерация
    api/             Mini App API: /me /quota /channels /drafts /gen /plan /faq /templates /trends /tariffs (initData-auth)
    scheduler/       tick каждые 5 мин: публикация due + пополнение очереди
    _shared/         json, initdata, prompts, ai, db, cors, queue, features,
                     moderation, autoreply, style, templates, rss, agents, roles,
                     payments, plans, vacation
  migrations/        0001_init, 0002_schedule, 0003_modules
  tests/             deno test (модули _shared, обработчики, SQL)
webapp/              Vite + React + TS + Tailwind, Beams-фон, Vercel
scripts/             deploy.ps1, set-webhook.ps1, set-menu-button.ps1
```

Таблицы базовые — `users`, `channels`, `posts`, `generation_log`.
Расширения:
- `0002`: posts + `scheduled_at`, `priority`, `published_at`, `reactions`,
  `subscribers`, idx `(channel_id, status, scheduled_at)`; channels +
  `quiet_hours`, `max_posts_per_day`, `post_hour`, `features` (jsonb),
  `vacation_from`, `vacation_to`.
- `0003`: `channel_members` (channel_id, user_id, role), `knowledge_base`
  (channel_id, content), `monitoring_channels` (channel_id, source),
  `templates` (user_id, channel_id, name, content), `agent_log` (user_id,
  agent, status), `stars_invoices` (user_id, amount, plan, status).
  Мёртвые таблицы team_members/moderation_blacklist — не создаются.

Таблицы:
- `users` (id uuid, telegram_id bigint unique, first_name, plan default 'free', created_at)
- `channels` (id, user_id → users, telegram_channel_id, title, created_at;
  + quiet_hours, max_posts_per_day, post_hour, features, vacation_from, vacation_to — из 0002)
- `posts` (id, user_id → users, channel_id nullable, content, rubric, status 'draft'|'queued'|'published', created_at;
  + scheduled_at, priority, published_at, reactions, subscribers — из 0002)
- `generation_log` (id, user_id, feature, model, created_at; idx (user_id, created_at))
- `channel_members`, `knowledge_base`, `monitoring_channels`, `templates`,
  `agent_log`, `stars_invoices` — из 0003

API — пути `/me`, `/quota`, `/channels`, `/channels/:id`, `/drafts`, `/gen`,
`/plan?days=`, `/faq`, `/templates`, `/trends`, `/tariffs`; заголовок
`x-init-data`; CORS Access-Control-Allow-*; ошибки JSON `{error}`. За квотой — 429.

## Объём этапов

- **Этап 0**: структура, env, git; _shared (json, initdata, prompts, ai, db, cors);
  миграция 0001; webhook-бот; api-функция; скрипты деплоя/webhook/меню-кнопки.
- **Этап 1**: генератор «пост из идеи» (4 рубрики, квоты, черновик +
  логирование), Mini App: старт-экран v4 (лесенка табов + квота + Beams-фон),
  экран генератора, экран черновиков.
- **Этап 2**: планирование и автопостинг (контент-календарь, очередь с
  fillTo=5 и приоритетами, тихие часы, пост-час, отпуск, тумблер автопостинга,
  scheduler-функция, миграция 0002).
- **Этап 3**: тренды и мультиканальность (RSS-тренды и быстрые посты,
  до N каналов по тарифу, командные роли owner/editor/moderator, экраны
  каналов/настроек, миграция 0003). Аналитика/отчёты НЕ входят.
- **Этап 4**: взаимодействие с аудиторией (тональность, модерация
  спама, база знаний, автоответы, эскалация владельцу; бот-админ канала).
- **Этап 5**: AI-агенты (ресёрчер→писатель→редактор, /fact, 1 пост = 1 квота).
- **Этап 6**: настройка и персонализация (профиль канала, стиль, шаблоны),
  монетизация Stars по тарифам ТЗ (invoices, pre_checkout_query), контент-план
  7/14/30 дней (для Pro), тумблеры функций.

## Критерии готовности

- `deno test --allow-read` (в supabase/) — зелёный (все _shared-модули,
  обработчики bot/api/scheduler, SQL-миграции 0001–0003).
- `npm run typecheck` + `npm run build` в webapp/ — зелёные; ручная проверка
  экранов в браузере (включая Beams-фон).
- Скрипты деплоя проходят в `-DryRun`.