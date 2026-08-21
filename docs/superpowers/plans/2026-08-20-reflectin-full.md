# Reflectin: Полный план (Этапы 2–6 + Beams) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Этапы 0+1 уже спланированы в `2026-08-20-stage-0-1.md` и исполняются отдельно и СТРОГО ПЕРЕД этим планом; здесь — этапы 2–6 и фон Beams для webapp.

**Goal:** Полный автономный инструмент ведения Telegram-каналов: автопостинг по расписанию, мультиканальность с лимитами тарифа, модерация и автоответы, тренды, стиль и шаблоны, AI-агенты (Pro), контент-план 7/14/30 дней, монетизация Stars по тарифам ТЗ, тумблеры включения функций. Мини App — с фоном react-bits Beams. **Аналитика/отчёты/алерты осознанно ВЫПИЛЕНЫ** (Bot API не отдаёт данные об эффективности канальных постов).

**Architecture:** всё строится на фундаменте Этапов 0+1 (webhook-бот `telegram-bot`, Mini App API `api` с initData-auth, `_shared/*` модули, миграции, `/gen` по квоте). Новое: edge-функция `scheduler` (тик каждые 5 минут через pg_cron → `net.http_post`), расширенные `_shared/*` (queue, features, moderation, autoreply, style, templates, rss, agents, roles, payments, plans, vacation, json→ai), миграции 0002 (расписание+фичи+отпуск) и 0003 (модули). Ключевой паттерн — чистые функции + инъекции (db, generate, sendMessage, fetch), всё тестируемо через `deno test`.

**Tech Stack:** Deno 2 (Edge Functions + `deno test`), Postgres (Supabase, service role), OpenRouter (REST, free-модели), Telegram Bot API (REST через `fetch`, webhook), Stars (createInvoiceLink, pre_checkout_query), frontend Vite + React 19 + TS + Tailwind v4 + `@phosphor-icons/react` + `react-bits` Beams.

## Global Constraints

- **Русский язык** интерфейса и голоса бота. **Без эмодзи** в контенте и UI. **Без градиентов**.
- **Дизайн v4:** фон монохромный (`#0b0b0d` / панели `#151518` / рамки `#222227`), акцент `#b4ff5a`.
- **Beams-фон:** `<Beams beamWidth={2} beamHeight={20} beamNumber={13} lightColor="#ffffff" speed={2} noiseIntensity={2} scale={0.15} rotation={0}/>` внутри обёртки 1080×1080 (absolute, centered), `pointer-events-none fixed inset-0 z-0`, контент `z-10`.
- **Тарифы (ТЗ):** free 2 канала/2 ген/день; starter **199★** 3 канала/10 ген/день; pro **499★** 5 каналов/50 ген/день + агенты + автомодерация + контент-план 30 дней; agency **999★** 10 каналов/командный доступ. Цены в `payments.ts` (`PLAN_PRICES`), лимиты в `plans.ts` (`planLimits`).
- **Тумблеры функций:** `channels.features jsonb default '{}'`; ключи `autoposting`, `moderation`, `autoreply`, `agents`, `trends`, `templates`; отсутствие ключа → фолбэк (включено). `isEnabled(features, key, fallback=true)`. Вкл/выкл — экран «Настройки» в Mini App → `PATCH /channels/:id`.
- **Квота по тарифу:** суточный лимит = `planLimits(user.plan).quota`; бесплатный план — `FREE_DAILY_QUOTA` (дефолт 2) из env в `index.ts` либо лимит free из plans. Считается по `generation_log` за сегодня. Агентский pipeline: **1 пост = 1 единица квоты** (одна запись в generation_log), сколько бы шагов ни было.
- **Очередь:** авто-пополнение, когда queued < `fillTo=5`; own считается только по `status='queued'`; priority: 0 (срочное) публикуется первым; тихие часы и `post_hour` учитываются при планировании нового слота (`ch.post_hour ?? deps.postHour ?? 10`). При пополнении НЕ пишем в generation_log (квота генераций — только для ручного/агентского использования).
- **Отпуск:** `vacation_from`/`vacation_to` (date) на канале; во время отпуска **публикуем готовый план**, но **не пополняем очередь**.
- **Роли:** `owner > editor > moderator` (`ROLE_LEVEL`), `atLeast(role, min)`; роли хранятся в `channel_members`; владелец = создатель канала (записывается при создании); назначение ролей — через Mini App.
- **Модерация:** бот назначается админом канала ВРУЧНУЮ пользователем; ветка обсуждения `chat.id < 0`; спам-ссылка → `deleteMessage` + `restrictChatMember`; негатив + вопрос → уведомление владельцу. Полноценные вызовы Bot API – когда бот админ.
- **Автопостинг:** `getChatMemberCount` → `posts.subscribers` при публикации; `reactions` недоступны — поле остаётся пустым (0).
- **Тесты:** `deno test` из `supabase/` (запуск `deno test --allow-read` — миграционные тесты читают SQL). Frontend — `npm run typecheck` + `npm run build` + ручная проверка в браузере.

## File Structure (добавляется поверх Этапов 0+1)

```
supabase/functions/
  scheduler/index.ts            # тик: публикация due + пополнение очереди (Deno.serve)
  scheduler/handler.ts          # handleTick (чистая логика, тестируется)
  _shared/queue.ts              # pickDue, shouldReplenish, nextSlot
  _shared/features.ts           # isEnabled (тумблеры функций)
  _shared/moderation.ts         # stanceOf, classifyComment
  _shared/autoreply.ts          # matchFaq, shouldEscalate
  _shared/style.ts              # buildStyleBlock
  _shared/templates.ts          # applyTemplate
  _shared/rss.ts                # parseRss, extractTrends
  _shared/agents.ts             # runPipeline (+researchStep/writerStep/editorStep)
  _shared/roles.ts              # ROLE_LEVEL, atLeast
  _shared/payments.ts           # PLAN_PRICES, starsByPlan, planByStars
  _shared/plans.ts              # planLimits, validatePlan, dailyQuota
  _shared/vacation.ts           # isVacationOn, vacationPolicy
  migrations/0002_schedule.sql
  migrations/0003_modules.sql
  tests/                        # *_test.ts (уже написаны, кроме новых features/plans)
webapp/ src/BeamsBackground.tsx # Beams-фон 1080×1080, белые лучи, z-0
```

## Межзадачные интерфейсы (типы-контракты)

- `queue.ts`: `pickDue(rows, nowIso)` → посты `status==='queued' && scheduled_at<=nowIso`, сортировка priority asc, затем scheduled_at asc; `shouldReplenish(count, fillTo=5)` → `count < fillTo`; `nextSlot(nowIso, quietHours, postHour)` → ближайший ISO-слот в пост-час, не в тихих часах, строго позже nowIso (завтра, если сегодняшний пост-час прошёл/в тихих часах).
- `features.ts`: `isEnabled(features: Record<string, boolean> | null | undefined, key: string, fallback = true)` → `features?.[key] ?? fallback`.
- `moderation.ts`: `stanceOf(text)` → `'positive'|'neutral'|'negative'`; `classifyComment(text)` → `{spam, stance}`, spam если есть ссылка `https?://` (или известный спам-паттерн из модуля).
- `autoreply.ts`: `matchFaq(text, faq: {q,a}[])` → ответ из базы знаний или null; `shouldEscalate(text, stance)` → негатив + вопросительный знак.
- `style.ts`: `buildStyleBlock({voice, maxPostsPerDay})` → строка-инструкция стиля (используется в `buildPostPrompt`).
- `templates.ts`: `applyTemplate(tpl, vars)` → замена `{key}` на vars[key], неизвестные остаются.
- `rss.ts`: `parseRss(xml)` → `FeedItem[]` (title, link); `extractTrends(items)` → слова по частоте (минимальная длина слова c фильтром `w.length >= 2`).
- `agents.ts`: `PipelineStep = {name, build(ctx)}`; `runPipeline(steps, generate, input)` → `{text, calls}`; `researchStep(topic)`, `writerStep()`, `editorStep()`.
- `roles.ts`: `ROLE_LEVEL = {owner:3, editor:2, moderator:1}`; `atLeast(role, min)`.
- `payments.ts`: `PLAN_PRICES = {starter:199, pro:499, agency:999}`; `starsByPlan(plan)`, `planByStars(stars)`.
- `plans.ts`: `Plan = 'free'|'starter'|'pro'|'agency'`; `planLimits(plan)` → `{channels, quota}` (`free{2,2}` `starter{3,10}` `pro{5,50}` `agency{10,200}`); `validatePlan(items, days=7)` → `{ok, error?}` для items `{day, rubric, topic}` длиной ровно days, корректные day (1..days) и rubric (польза|история|совет|вопрос|новость|мнение); `dailyQuota(plan, freeDefault)`.
- `vacation.ts`: `isVacationOn(vacation, dateISO)` (`from`/`to` включительно); `vacationPolicy(vacation, today)` → `'pause' | null`.
- `scheduler/handler.ts`: `handleTick({db, generate, sendMessage, getMemberCount?, nowIso, fillTo=5, postHour=10, quietHours=[]})` → `{published, replenished, subscribers}`.

---

## Task 1: `_shared/queue.ts` — очередь публикаций

**Files:** Create `supabase/functions/_shared/queue.ts`; Test `supabase/tests/queue_test.ts` (написан).

- [ ] **Step 1: Тест красный**
Run: `deno test tests/queue_test.ts --no-check` → `Module not found …/queue.ts`.

- [ ] **Step 2: Реализация**

```ts
export interface DueRow {
  id: string;
  channel_id?: string;
  content: string;
  status: string;
  scheduled_at: string;
  priority: number;
}

export function pickDue(rows: DueRow[], nowIso: string): DueRow[] {
  return rows
    .filter((r) => r.status === "queued" && r.scheduled_at <= nowIso)
    .sort((a, b) => a.priority - b.priority || a.scheduled_at.localeCompare(b.scheduled_at));
}

export function shouldReplenish(count: number, fillTo = 5): boolean {
  return count < fillTo;
}

export function nextSlot(nowIso: string, quietHours: number[], postHour: number): string {
  for (let d = 0; d < 8; d++) {
    const dt = new Date(new Date(nowIso).getTime() + d * 86400000);
    const withHour = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), postHour, 0, 0));
    if (withHour.toISOString() > nowIso && !quietHours.includes(withHour.getUTCHours())) {
      return withHour.toISOString();
    }
  }
  return nowIso;
}
```

- [ ] **Step 3: Зелёный**
Run: `deno test tests/queue_test.ts` → 10 passed.

- [ ] **Step 4: Коммит**
```bash
git add supabase/functions/_shared/queue.ts supabase/tests/queue_test.ts
git commit -m "feat: очередь публикаций (pickDue/shouldReplenish/nextSlot)"
```

---

## Task 2: Миграция `0002_schedule.sql`

**Files:** Create `supabase/migrations/0002_schedule.sql`; Test `supabase/tests/0002_migration_test.ts` (написан).

- [ ] **Step 1: Тест красный**
Run: `deno test tests/0002_migration_test.ts --no-check` → FAIL (файл не найден).

- [ ] **Step 2: SQL**

```sql
alter table public.posts
  add column if not exists scheduled_at timestamptz,
  add column if not exists priority int not null default 10,
  add column if not exists published_at timestamptz,
  add column if not exists reactions int not null default 0,
  add column if not exists subscribers int not null default 0;

alter table public.channels
  add column if not exists quiet_hours int[] not null default '{}',
  add column if not exists max_posts_per_day int not null default 5,
  add column if not exists post_hour int,
  add column if not exists features jsonb not null default '{}',
  add column if not exists vacation_from date,
  add column if not exists vacation_to date;

create index if not exists idx_posts_due
  on public.posts (channel_id, status, scheduled_at);
```

- [ ] **Step 3: Зелёный**
Run: `deno test tests/0002_migration_test.ts` → 4 passed (планирование + фичи/отпуск в channels + счётчики в posts).

- [ ] **Step 4: Коммит**
```bash
git add supabase/migrations/0002_schedule.sql supabase/tests/0002_migration_test.ts
git commit -m "feat: схема расписания/фич/отпуска (scheduled_at,post_hour,features,vacation)"
```

---

## Task 3: `_shared/features.ts` — тумблеры функций

**Files:** Create `supabase/functions/_shared/features.ts`; Test `supabase/tests/features_test.ts` (написан).

- [ ] **Step 1: Тест красный** — `deno test tests/features_test.ts --no-check`.

- [ ] **Step 2: Реализация**

```ts
export type FeatureKey =
  | "autoposting"
  | "moderation"
  | "autoreply"
  | "agents"
  | "trends"
  | "templates";

export function isEnabled(
  features: Record<string, boolean> | null | undefined,
  key: string,
  fallback = true,
): boolean {
  return features?.[key] ?? fallback;
}
```

- [ ] **Step 3: Зелёный** — `deno test tests/features_test.ts` → 5 passed.

- [ ] **Step 4: Коммит**
```bash
git add supabase/functions/_shared/features.ts supabase/tests/features_test.ts
git commit -m "feat: тумблеры включения функций (isEnabled)"
```

---

## Task 4: `_shared/moderation.ts` + `_shared/autoreply.ts`

**Files:** Create `supabase/functions/_shared/moderation.ts`, `supabase/functions/_shared/autoreply.ts`; Tests `moderation_test.ts`, `autoreply_test.ts` (написаны).

- [ ] **Step 1: Тесты красные** — оба `--no-check`.

- [ ] **Step 2: `moderation.ts`**

```ts
export type Stance = "positive" | "neutral" | "negative";

const POS: string[] = ["спасибо", "класс", "супер", "полезно", "отлично", "круто"];
const NEG: string[] = ["ерунда", "бред", "ужас", "плохо", "мусор", "не работает", "зря"];

export function stanceOf(text: string): Stance {
  const t = text.toLowerCase();
  const pos = POS.some((w) => t.includes(w));
  const neg = NEG.some((w) => t.includes(w));
  if (neg) return "negative";
  if (pos) return "positive";
  return "neutral";
}

export function classifyComment(text: string): { spam: boolean; stance: Stance } {
  return { spam: /https?:\/\//i.test(text), stance: stanceOf(text) };
}
```

- [ ] **Step 3: `autoreply.ts`**

```ts
export interface FaqEntry { q: string; a: string }

export function matchFaq(text: string, faq: FaqEntry[]): string | null {
  const t = text.toLowerCase();
  for (const e of faq) {
    if (t.includes(e.q.toLowerCase())) return e.a;
  }
  return null;
}

export function shouldEscalate(text: string, stance: string): boolean {
  return stance === "negative" && text.includes("?");
}
```

- [ ] **Step 4: Зелёные** — `deno test tests/moderation_test.ts tests/autoreply_test.ts` → 5 + 5 passed.

- [ ] **Step 5: Коммит**
```bash
git add supabase/functions/_shared/moderation.ts supabase/functions/_shared/autoreply.ts supabase/tests/moderation_test.ts supabase/tests/autoreply_test.ts
git commit -m "feat: тональность, фильтр спама, база знаний, автоответы"
```

---

## Task 5: `_shared/style.ts` + `_shared/templates.ts`

**Files:** Create `style.ts`, `templates.ts`; Tests `style_test.ts`, `templates_test.ts` (написаны).

- [ ] **Step 1: Тесты красные** — `--no-check`.

- [ ] **Step 2: `style.ts`**

```ts
export interface StylePref {
  voice: string;
  maxPostsPerDay: number;
}

export function buildStyleBlock(style: StylePref): string {
  const voice = style.voice?.trim() || "без выраженного голоса, нейтрально";
  return `Голос канала: ${voice}. Максимум ${style.maxPostsPerDay} поста в день. Без эмодзи.`;
}
```

- [ ] **Step 3: `templates.ts`**

```ts
export function applyTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? vars[k] : `{${k}}`));
}
```

- [ ] **Step 4: Зелёные** — `3 + 3 passed`.

- [ ] **Step 5: Коммит**
```bash
git add supabase/functions/_shared/style.ts supabase/functions/_shared/templates.ts supabase/tests/style_test.ts supabase/tests/templates_test.ts
git commit -m "feat: блок стиля канала и шаблоны с плейсхолдерами"
```

---

## Task 6: `_shared/rss.ts` — тренды из RSS

**Files:** Create `supabase/functions/_shared/rss.ts`; Test `supabase/tests/trends_rss_test.ts` (написан).

- [ ] **Step 1: Тест красный** — `--no-check`.

- [ ] **Step 2: Реализация**

```ts
export interface FeedItem { title: string; link: string }

const ITEM_RE = /<item>[\s\S]*?<\/item>/g;
const TITLE_RE = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/;
const LINK_RE = /<link>([\s\S]*?)<\/link>/;

export function parseRss(xml: string): FeedItem[] {
  const out: FeedItem[] = [];
  for (const m of xml.match(ITEM_RE) ?? []) {
    const t = m.match(TITLE_RE)?.[1];
    const l = m.match(LINK_RE)?.[1];
    if (t && l) out.push({ title: t.trim(), link: l.trim() });
  }
  return out;
}

export function extractTrends(items: FeedItem[]): string[] {
  const freq: Record<string, number> = {};
  for (const it of items) {
    for (const word of it.title.split(/\s+/)) {
      const w = word.replace(/[^A-Za-zА-Яа-яЁё0-9]/g, "").toLowerCase();
      if (w.length >= 2) freq[w] = (freq[w] ?? 0) + 1;
    }
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([w]) => w);
}
```

- [ ] **Step 3: Зелёный**
Run: `deno test tests/trends_rss_test.ts` → 4 passed.

- [ ] **Step 4: Коммит**
```bash
git add supabase/functions/_shared/rss.ts supabase/tests/trends_rss_test.ts
git commit -m "feat: RSS-тренды (parseRss/extractTrends)"
```

---

## Task 7: `_shared/agents.ts` — мультиагентный pipeline

**Files:** Create `supabase/functions/_shared/agents.ts`; Test `supabase/tests/agents_pipeline_test.ts` (написан).

- [ ] **Step 1: Тест красный** — `--no-check`.

- [ ] **Step 2: Реализация**

```ts
import { extractJson } from "./json.ts";

export interface PipelineStep {
  name: string;
  build: (ctx: string) => string;
}

export type GenerateFn = (prompt: string) => Promise<{ text: string; model: string }>;

export async function runPipeline(
  steps: PipelineStep[],
  generate: GenerateFn,
  input: string,
): Promise<{ text: string; calls: number }> {
  let ctx = input;
  let calls = 0;
  for (const step of steps) {
    const { text } = await generate(step.build(ctx));
    calls += 1;
    ctx = text;
  }
  return { text: ctx, calls };
}

/** Агент-ресёрчер: просит структурированные факты по теме. */
export function researchStep(topic: string): PipelineStep {
  return {
    name: "research",
    build: (ctx) => {
      const idea = ctx.trim().startsWith("{") ? (extractJson(ctx) as { topic?: string }).topic ?? topic : topic;
      return `Собери 3-5 фактов/идей по теме «${idea}». Верни ТОЛЬКО JSON: {"topic":"...","facts":["..."]}.`;
    },
  };
}

/** Агент-писатель: пишет пост из результатов ресёрча. */
export function writerStep(): PipelineStep {
  return {
    name: "write",
    build: (ctx) => `Напиши телеграм-пост на основе: ${ctx}. Без эмодзи, короткие абзацы, живой голос.`,
  };
}

/** Агент-редактор: чистит и усиливает вовлечение. */
export function editorStep(): PipelineStep {
  return {
    name: "editor",
    build: (ctx) =>
      `Отредактируй пост для максимального вовлечения: ${ctx}. Верни ТОЛЬКО финальный текст поста.`,
  };
}
```

- [ ] **Step 3: Зелёный**
Run: `deno test tests/agents_pipeline_test.ts` → 3 passed.

- [ ] **Step 4: Коммит**
```bash
git add supabase/functions/_shared/agents.ts supabase/tests/agents_pipeline_test.ts
git commit -m "feat: мультиагентный pipeline (ресёрчер→писатель→редактор)"
```

---

## Task 8: `_shared/roles.ts` + `_shared/payments.ts` + `_shared/plans.ts`

**Files:** Create `roles.ts`, `payments.ts`, `plans.ts`; Tests `roles_rbac_test.ts`, `payments_test.ts`, `plans_test.ts` (написаны).

- [ ] **Step 1: Тесты красные** — `--no-check`.

- [ ] **Step 2: `roles.ts`**

```ts
export const ROLE_LEVEL: Record<string, number> = { moderator: 1, editor: 2, owner: 3 };

export function atLeast(role: string, min: string): boolean {
  return (ROLE_LEVEL[role] ?? 0) >= (ROLE_LEVEL[min] ?? 0);
}
```

- [ ] **Step 3: `payments.ts`** — цены ТЗ в звёздах.

```ts
export const PLAN_PRICES: Record<string, number> = { starter: 199, pro: 499, agency: 999 };

export function starsByPlan(plan: string): number | null {
  return PLAN_PRICES[plan] ?? null;
}

export function planByStars(stars: number): string | null {
  const hit = Object.entries(PLAN_PRICES).find(([, s]) => s === stars);
  return hit ? hit[0] : null;
}
```

- [ ] **Step 4: `plans.ts`** — лимиты и валидация контент-плана.

```ts
export type Plan = "free" | "starter" | "pro" | "agency";

export interface PlanLimits { channels: number; quota: number }

const LIMITS: Record<Plan, PlanLimits> = {
  free: { channels: 2, quota: 2 },
  starter: { channels: 3, quota: 10 },
  pro: { channels: 5, quota: 50 },
  agency: { channels: 10, quota: 200 },
};

export function planLimits(plan: string): PlanLimits {
  return LIMITS[(plan as Plan) || "free"] ?? LIMITS.free;
}

export function dailyQuota(plan: string, freeDefault: number): number {
  return plan === "free" ? freeDefault : planLimits(plan).quota;
}

export const RUBRICS = ["польза", "история", "совет", "вопрос", "новость", "мнение"];

export interface PlanItem { day: number; rubric: string; topic: string }

export function validatePlan(
  items: PlanItem[] | null | undefined,
  days = 7,
): { ok: true } | { ok: false; error: string } {
  if (!Array.isArray(items)) return { ok: false, error: "не массив" };
  if (items.length !== days) return { ok: false, error: `нужно ${days} пунктов` };
  for (const it of items) {
    if (typeof it.day !== "number" || it.day < 1 || it.day > days) {
      return { ok: false, error: `неверный день ${it?.day}` };
    }
    if (typeof it.topic !== "string" || !it.topic.trim()) {
      return { ok: false, error: "пустая тема" };
    }
    if (!RUBRICS.includes(it.rubric)) {
      return { ok: false, error: `неизвестная рубрика ${it.rubric}` };
    }
  }
  return { ok: true };
}
```

- [ ] **Step 5: Зелёные** — `4 + 5 + 6 passed` (сумма берётся из фактических тестов, см. вывод deno test).

- [ ] **Step 6: Коммит**
```bash
git add supabase/functions/_shared/roles.ts supabase/functions/_shared/payments.ts supabase/functions/_shared/plans.ts supabase/tests/roles_rbac_test.ts supabase/tests/payments_test.ts supabase/tests/plans_test.ts
git commit -m "feat: командные роли, тарифы ТЗ, лимиты планов и валидация контент-плана"
```

---

## Task 9: Миграция `0003_modules.sql`

**Files:** Create `supabase/migrations/0003_modules.sql`; Test `supabase/tests/0003_migration_test.ts` (написан).

- [ ] **Step 1: Тест красный** — `--no-check`.

- [ ] **Step 2: SQL**

```sql
create table public.channel_members (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'moderator',
  created_at timestamptz not null default now()
);

create index if not exists idx_channel_members_channel
  on public.channel_members (channel_id, user_id);

create table public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.monitoring_channels (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  source text not null,
  created_at timestamptz not null default now()
);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete cascade,
  name text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.agent_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  agent text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.stars_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount int not null,
  plan text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
```

- [ ] **Step 3: Зелёный**
Run: `deno test tests/0003_migration_test.ts` → 1 passed (5 таблиц, без team_members/blacklist).

- [ ] **Step 4: Коммит**
```bash
git add supabase/migrations/0003_modules.sql supabase/tests/0003_migration_test.ts
git commit -m "feat: схема модулей (роли каналов/база знаний/шаблоны/агенты/звёзды)"
```

---

## Task 10: Scheduler — edge-функция автопостинга

**Files:** Create `supabase/functions/scheduler/index.ts`, `supabase/functions/scheduler/handler.ts`; Test `supabase/tests/scheduler_test.ts` (написан).

- [ ] **Step 1: Тест красный** — `deno test tests/scheduler_test.ts --no-check`.

- [ ] **Step 2: `handler.ts`** — публикация due (с записью подписчиков через `getMemberCount`) + пополнение очереди: **без записи generation_log**, но с agent_log; own только по `status='queued'`; отпуск → не пополняем; выключенный `autoposting` → канал пропускается.

```ts
import type { Db } from "../_shared/db.ts";
import { isEnabled } from "../_shared/features.ts";
import { pickDue, shouldReplenish, nextSlot } from "../_shared/queue.ts";
import { buildPostPrompt } from "../_shared/prompts.ts";
import { vacationPolicy } from "../_shared/vacation.ts";

export interface SchedulerDeps {
  db: Db;
  generate: (prompt: string) => Promise<{ text: string; model: string }>;
  sendMessage: (chatId: number, text: string) => Promise<unknown>;
  nowIso: string;
  fillTo?: number;
  postHour?: number;
  quietHours?: number[];
  getMemberCount?: (chatId: number) => Promise<number | null>;
}

export async function handleTick(deps: SchedulerDeps): Promise<{ published: number; replenished: number }> {
  const fillTo = deps.fillTo ?? 5;
  const postHour = deps.postHour ?? 10;
  const quietHours = deps.quietHours ?? [];
  const channels = ((await deps.db.from("channels").select()) ?? { data: [] }).data ?? [];
  const queued = ((await deps.db.from("posts").eq("status", "queued").select()) ?? { data: [] }).data ?? [];

  let published = 0;
  for (const post of pickDue(queued, deps.nowIso)) {
    const ch = channels.find((c: { id: string }) => c.id === post.channel_id);
    if (!ch?.telegram_channel_id) continue;
    if (!isEnabled(ch.features, "autoposting", true)) continue;
    await deps.sendMessage(Number(ch.telegram_channel_id), post.content);
    let subscribers: number | undefined;
    if (deps.getMemberCount) {
      subscribers = (await deps.getMemberCount(Number(ch.telegram_channel_id))) ?? undefined;
    }
    await deps.db.from("posts").eq("id", post.id).update({
      status: "published",
      published_at: deps.nowIso,
      ...(subscribers !== undefined ? { subscribers } : {}),
    });
    published += 1;
  }

  let replenished = 0;
  for (const ch of channels) {
    if (!isEnabled(ch.features, "autoposting", true)) continue;
    const vac = ch.vacation_from && ch.vacation_to ? { from: ch.vacation_from, to: ch.vacation_to } : null;
    if (vacationPolicy(vac, deps.nowIso.slice(0, 10)) === "pause") continue;
    const own = (queued as Array<{ channel_id?: string; status: string }>)
      .filter((p) => p.channel_id === ch.id && p.status === "queued").length;
    const needed = fillTo - own;
    if (needed <= 0) continue;
    for (let i = 0; i < needed; i++) {
      const ph = ch.post_hour ?? postHour;
      const prompt = buildPostPrompt({
        topic: `Тема из очереди канала «${ch.title ?? ""}» (пополнение)`,
        rubric: "польза",
        channelTitle: ch.title,
      });
      const { text } = await deps.generate(prompt);
      await deps.db.from("posts").insert({
        user_id: ch.user_id,
        channel_id: ch.id,
        content: text,
        rubric: "польза",
        status: "queued",
        scheduled_at: nextSlot(deps.nowIso, quietHours, ph),
        priority: 10,
      });
      await deps.db.from("agent_log").insert({ user_id: ch.user_id, agent: "scheduler", status: "ok", created_at: deps.nowIso });
      replenished += 1;
    }
  }

  return { published, replenished };
}
```

> Примечание: НЕ пишем generation_log при пополнении — суточная квота генераций относится к ручным/агентским генерациям, автопостинг не тратит квоту пользователя. O(n²) поиск канала на пост — ок для масштаба лимита каналов по тарифу. `ponytail: own считает только queued — если позже понадобится «черновики тоже считаются», добавить фильтр здесь`.

- [ ] **Step 3: `index.ts`**

```ts
import { handleTick } from "./handler.ts";
import { dbFromEnv } from "../_shared/db.ts";
import { resolveModels, completeWithFallback } from "../_shared/ai.ts";

function token() { return Deno.env.get("BOT_TOKEN") ?? ""; }

Deno.serve(async () => {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY") ?? "";
  const models = resolveModels(Deno.env.get("OPENROUTER_MODELS"));
  const base = `https://api.telegram.org/bot${token()}`;
  await handleTick({
    db: dbFromEnv(),
    generate: (prompt) =>
      completeWithFallback({ apiKey, models, messages: [{ role: "user", content: prompt }] }),
    sendMessage: async (chatId, text) => {
      const res = await fetch(`${base}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      return res.json();
    },
    getMemberCount: async (chatId) => {
      const res = await fetch(`${base}/getChatMemberCount`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId }) });
      const data = await res.json();
      return data.ok ? (data.result as number) : null;
    },
    nowIso: new Date().toISOString(),
  });
  return new Response("ok");
});
```

- [ ] **Step 4: Зелёный**
Run: `deno test tests/scheduler_test.ts --allow-read` → 4 passed.

- [ ] **Step 5: Коммит**
```bash
git add supabase/functions/scheduler supabase/tests/scheduler_test.ts
git commit -m "feat: scheduler — публикация due и пополнение очереди (фичи/отпуск)"
```

---

## Task 11: pg_cron — триггер тика каждые 5 минут

**Files:** Modify: `supabase/migrations/0003_modules.sql` (добавить cron), `scripts/deploy.ps1` (не требуется).

- [ ] **Step 1: Добавить в 0003 (после таблиц)**

```sql
create extension if not exists pg_cron;

select cron.schedule(
  'reflectin-scheduler',
  '*/5 * * * *',
  'select net.http_post(
     url := ''https://<project-ref>.supabase.co/functions/v1/scheduler'',
     headers := jsonb_build_object(''Content-Type'', ''application/json'',''Authorization'', ''Bearer \'' || current_setting(''request.jwt.claim.sub'', true) || '''''),
     body := ''{}''::jsonb
   )'
);
```

> Примечание: `<project-ref>` подставляется при деплое. Если `pg_net` недоступен — `functions.http_request`. Для локальной разработки тик не требуется (тест закрывает логику).

- [ ] **Step 2: Коммит**
```bash
git add supabase/migrations/0003_modules.sql
git commit -m "feat: pg_cron тик scheduler каждые 5 минут"
```

---

## Task 12: Beams-фон для Mini App

**Files:** Modify: `webapp/package.json`, `webapp/src/index.css`, `webapp/src/App.tsx`; Create: `webapp/src/BeamsBackground.tsx`; Verify: `npm run typecheck` + `npm run build`.

- [ ] **Step 1: Установить react-bits через shadcn registry**

```bash
cd webapp
npx shadcn@latest init -y -b neutral
npx shadcn@latest add @react-bits/Beams-JS-CSS -y
```

Ожидание: появилась папка `src/components/ui/` + компонент beams (панель/beams, types). Если registry недоступен — установить вручную:
```bash
npm i @react-bits/beams-js-css
```

- [ ] **Step 2: `webapp/src/BeamsBackground.tsx`**

```tsx
import { Beams } from "./components/ui/beams";

export default function BeamsBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute left-1/2 top-1/2 h-[1080px] w-[1080px] -translate-x-1/2 -translate-y-1/2">
        <Beams
          beamWidth={2}
          beamHeight={20}
          beamNumber={13}
          lightColor="#ffffff"
          speed={2}
          noiseIntensity={2}
          scale={0.15}
          rotation={0}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Подключить в `App.tsx`** (корень: `relative`)

```tsx
import BeamsBackground from "./BeamsBackground";
// внутри return:
<>
  <BeamsBackground />
  <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[400px] flex-col bg-bg text-ink">
    {/* ...существующее содержимое... */}
  </div>
</>
```

- [ ] **Step 4: Проверить**

Run: `cd webapp; npm run typecheck; npm run build` → успех.
Ручная проверка в браузере: фон — тонкие белые лучи по диагонали на монохромном тёмном фоне, контент поверх; интерактив работает (лучи не перехватывают клики).

- [ ] **Step 5: Коммит**
```bash
git add webapp
git commit -m "feat: Beams-фон react-bits в Mini App"
```

---

## Task 13: API — каналы, настройки-тумблеры, контент-план, тарифы, тренды, шаблоны

**Files:** Modify: `supabase/functions/api/handler.ts`, `api/index.ts`; Tests: расширенные `api_test.ts`.

- [ ] **Step 1: Тесты** — новые записи в `api_test.ts` (красные):

```ts
Deno.test("POST /channels — создаёт канал и роль владельца", async () => {
  const db = makeFakeDb({ users: [{ id: "id1" }], channel_members: [], channels: [] });
  const res = await handleApiRequest(await signedReq("/channels", { telegram_channel_id: "@kanal", title: "К" }), deps({ db }));
  assertEquals(res.status, 200);
  assert(db.calls.some((c) => c.startsWith("insert:channels")), "нет insert в каналы");
  assert(db.calls.some((c) => c.startsWith("insert:channel_members")), "нет роли владельца");
});

Deno.test("POST /channels — блокирует сверх лимита плана", async () => {
  const db = makeFakeDb({
    users: [{ id: "id1", plan: "free" }],
    channels: [
      { id: "c1", user_id: "id1" },
      { id: "c2", user_id: "id1" },
    ],
  });
  const res = await handleApiRequest(await signedReq("/channels", { telegram_channel_id: "@x", title: "X" }), deps({ db }));
  assertEquals(res.status, 403);
});

Deno.test("PATCH /channels/:id — переключает features", async () => {
  const db = makeFakeDb({ users: [{ id: "id1" }], channels: [{ id: "ch1", user_id: "id1", features: {} }] });
  const res = await handleApiRequest(await signedReq("/channels/ch1", { features: { autoposting: false } }), deps({ db }));
  assertEquals(res.status, 200);
  assertEquals(db.rows.channels[0].features.autoposting, false);
});

Deno.test("GET /plan?days=14 — контент-план, 30 запрещено без pro", async () => {
  const db = makeFakeDb({ users: [{ id: "id1", plan: "free" }] });
  const res = await handleApiRequest(await signedReq("/plan?days=30"), deps({ db }));
  assertEquals(res.status, 403);
});

Deno.test("GET /trends — тренды из мониторинга (мок fetch)", async () => {
  const db = makeFakeDb({ users: [{ id: "id1" }], monitoring_channels: [{ id: "m1", channel_id: "c1", source: "https://feed.example/rss" }] });
  const feed = "<rss><channel><item><title>ИИ тренд</title><link>https://x/1</link></item><item><title>ИИ снова</title><link>https://x/2</link></item></channel></rss>";
  const res = await handleApiRequest(await signedReq("/trends"), deps({
    db,
    fetch: async () => new Response(feed, { status: 200 }),
  }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assert(body.trends?.length >= 1);
});
```

- [ ] **Step 2: API-хендлер** — в `api/handler.ts` перед 404: `me` (план+лимиты), `channels` (list POST create с лимитом плана + seed роли владельца), `channels/:id` (PATCH features/vacation/post_hour/style/max_posts_per_day с проверкой `atLeast(role, "editor")`), `plan?days=7|14|30` (30 → только `plan === "pro"`; один вызов generate → JSON-массив, `validatePlan`; **1 запись квоты**), `faq` (GET/POST в knowledge_base), `templates` (GET/POST, `applyTemplate` в генераторе по `template_id`), `trends` (fetch мониторинг-каналов до 10 → parseRss/extractTrends → топ-10; ошибки источников глотаем; отключено если `!isEnabled(ch.features, "trends", true)` → 403). `/gen` и `/drafts` теперь используют `dailyQuota(user.plan, FREE_DAILY_QUOTA)`.

- [ ] **Step 3: Зелёный** — `deno test tests/api_test.ts --allow-read` → зелёный (все новые + старые из Этапа 1).

- [ ] **Step 4: Коммит**
```bash
git add supabase/functions/api supabase/tests/api_test.ts
git commit -m "feat: API — каналы/тумблеры/контент-план/тарифы/тренды/шаблоны"
```

---

## Task 14: Бот — /fact, модерация, автоответы

**Files:** Modify: `supabase/functions/telegram-bot/handler.ts`, `telegram-bot/index.ts`; Tests: `supabase/tests/tgbot_test.ts` (расширен), `supabase/tests/moderation_bot_test.ts` (новый).

- [ ] **Step 1: Тесты** — красные:

```ts
Deno.test("команда /fact — agent/pipeline, 1 единица квоты", async () => {
  const db = makeFakeDb({ users: [{ id: "u1", telegram_id: 123, plan: "pro" }] });
  const { deps: d, sends } = deps({ db });
  const r = await handleUpdate({ message: { message_id: 3, chat: { id: 10 }, from: { id: 123, first_name: "Дима" }, text: "/fact отпуск" } }, d);
  assertEquals(r, "agent");
  const dl = db.calls.filter((c) => c.startsWith("insert:generation_log"));
  assertEquals(dl.length, 1, "один пост = одна единица квоты");
  assert(db.calls.some((c) => c.startsWith("insert:posts")));
});

Deno.test("сообщение со спам-ссылкой в обсуждении — модерация", async () => {
  const db = makeFakeDb({
    channels: [{ id: "c1", user_id: "u1", telegram_channel_id: -100123, features: { moderation: true } }],
    channel_members: [{ id: "m1", channel_id: "c1", user_id: "u1", role: "owner" }],
  });
  const r = await handleUpdate({ message: { message_id: 7, chat: { id: -100123, type: "supergroup" }, from: { id: 55, first_name: "Бот" }, text: "Купи тут https://spam.example" } }, deps({ db }));
  assertEquals(r, "moderate");
});

Deno.test("вопрос из базы знаний — автоответ", async () => {
  const db = makeFakeDb({
    channels: [{ id: "c1", user_id: "u1", telegram_channel_id: -100123, features: { autoreply: true } }],
    knowledge_base: [{ id: "k1", channel_id: "c1", content: "цена стоит 500" }],
  });
  const { deps: d, sends } = deps({ db });
  await handleUpdate({ message: { message_id: 8, chat: { id: -100123 }, from: { id: 55, first_name: "Бот" }, text: "а сколько стоит?" } }, d);
  assert(sends.some((s) => s[1].includes("цена")), "ожидался ответ из базы знаний");
});
```

- [ ] **Step 2: `/fact` в handler** — ветка до `/gen`-логики:

```ts
if (text.startsWith("/fact ") || text === "/fact") {
  const topic = text === "/fact" ? "" : text.slice(6).trim();
  if (!topic) { await deps.sendMessage(chatId, "Укажи тему: /fact бухгалтерия для ИП"); return "agent"; }
  const dbUser = await getOrCreateUser(deps.db, msg.from.id, msg.from.first_name ?? "");
  if (dbUser.plan !== "pro") { await deps.sendMessage(chatId, "Агенты доступны на тарифе Pro"); return "agent"; }
  const used = await quotaUsedToday(deps.db, dbUser.id);
  if (used >= dailyQuota(dbUser.plan, deps.freeQuota)) { await deps.sendMessage(chatId, `Дневной лимит генераций исчерпан.`); return "agent"; }
  const { text: result } = await runPipeline([researchStep(topic), writerStep(), editorStep()], deps.generate, topic);
  await insertPost(deps.db, { user_id: dbUser.id, content: result, rubric: "новость", status: "draft" });
  await logGeneration(deps.db, { user_id: dbUser.id, feature: "agent", model: "pipeline" }); // 1 единица за результат
  await deps.sendMessage(chatId, result);
  return "agent";
}
```

- [ ] **Step 3: модерация/автоответы** — в handler для `chat.id < 0` (обсуждения канала): если `features.moderation` — `classifyComment`; spam → `deleteMessage(chat_id, message_id)` + `restrictChatMember` (в `index.ts` реальные вызовы Bot API); негатив+вопрос → уведомление владельцу. Если `features.autoreply` — `matchFaq` по `knowledge_base` канала → ответ. Игнорируем сообщения самого бота.

- [ ] **Step 4: Зелёный + коммит**
Run: `deno test tests/tgbot_test.ts tests/moderation_bot_test.ts --allow-read` → зелёный.
```bash
git add supabase/functions/telegram-bot supabase/tests/tgbot_test.ts supabase/tests/moderation_bot_test.ts
git commit -m "feat: бот — агент /fact (Pro), модерация и автоответы"
```

---

## Task 15: Монетизация Stars (invoice + подтверждение + план)

**Files:** Modify: `supabase/functions/telegram-bot/handler.ts`, `telegram-bot/index.ts`, `api/handler.ts`; Create: `supabase/functions/telegram-bot/stars.ts`, `supabase/tests/stars_test.ts`.

- [ ] **Step 1: `stars_test.ts`** — тест-контракт:

```ts
import { assertEquals, assert } from "jsr:@std/assert";
import { invoiceUrl, applyPlanPayment } from "../functions/telegram-bot/stars.ts";
import { makeFakeDb } from "./fake_db.ts";

Deno.test("invoiceUrl: createInvoiceLink с планом", () => {
  const url = invoiceUrl("t", 1, 199, "Starter");
  assert(url.includes("createInvoiceLink"));
  assert(url.includes("payload="));
});

Deno.test("applyPlanPayment: ставит план пользователю", () => {
  const db = makeFakeDb({ users: [{ id: "u1", plan: "free" }] });
  applyPlanPayment(db, "u1", "pro");
  assertEquals(db.rows.users[0].plan, "pro");
});
```

- [ ] **Step 2: `telegram-bot/stars.ts`**

```ts
import type { Db } from "../_shared/db.ts";
import { starsByPlan } from "../_shared/payments.ts";

export function invoiceUrl(token: string, chatId: number, amount: number, title: string): string {
  return `https://api.telegram.org/bot${token}/createInvoiceLink?chat_id=${chatId}&title=${encodeURIComponent(title)}&description=${encodeURIComponent("Подписка Reflectin")}&payload=${encodeURIComponent(`plan:${title.toLowerCase()}`)}&provider_token=&currency=XTR&prices=${encodeURIComponent(`[{"label":"${title}","amount":${amount}}]`)}`;
}

export async function applyPlanPayment(db: Db, userId: string, plan: string): Promise<void> {
  await db.from("users").eq("id", userId).update({ plan });
}
```

- [ ] **Step 3: бот-команда** — `/tariffs` возвращает кнопки тарифов с inline-ссылками `invoiceUrl` (или клавиатуру с payload `tariff:pro`); `pre_checkout_query` → `answerPreCheckoutQuery(true)` + `successful_payment` → `applyPlanPayment` по payload.
`BotDeps` дополнить `answerPreCheckout(id, ok): Promise<unknown>` и `sendInvoiceUrl(chatId, title, payload): Promise<unknown>` — реализация в `index.ts` (`POST /createInvoiceLink` затем `sendMessage` с URL). Обновить `tgbot_test.ts` — тест pre_checkout.

- [ ] **Step 4: API список тарифов** — `GET /tariffs` из `PLAN_PRICES` + лимиты `planLimits` (для экрана «Тарифы»).

- [ ] **Step 5: Зелёный + коммит**
Run: `deno test --allow-read` → зелёный.
```bash
git add supabase/functions/telegram-bot supabase/functions/api supabase/tests/stars_test.ts supabase/tests/tgbot_test.ts
git commit -m "feat: оплата Stars по тарифам ТЗ (invoice + pre_checkout → план)"
```

---

## Task 16: Webapp — экраны (каналы, настройки, план, тарифы, шаблоны)

**Files:** Modify: `webapp/src/App.tsx`, `webapp/src/lib/api.ts`; Verify: `npm run typecheck` + build.

- [ ] **Step 1: `api.ts`** — новые методы: `fetchChannels`, `createChannel`, `patchChannel(id, fields)`, `fetchPlan(days)`, `fetchTrends`, `fetchTemplates`, `saveTemplate`, `fetchFaq`, `addFaq`, `fetchTariffs`.

- [ ] **Step 2: экраны** (заменить заглушки табов, использовать `card`, полосу рубрики `RUBRIC_ACCENT`, акцент `#b4ff5a`, иконки Phosphor):
  - **Настройки**: на каждом канале тумблеры `autoposting/moderation/autoreply/agents/trends/templates` → `patchChannel(id, {features})`; поля `post_hour`, `vacation_from/to`, голос.
  - **Каналы**: список + форма добавления (`POST /channels`); ошибка 403 «лимит тарифа» → бадж «Расширьте тариф».
  - **План**: выбор 7/14/30 дней (30 — затемнён, пока не Pro) → `fetchPlan(days)` → список {день, рубрика, тема} с полосой рубрики.
  - **Тарифы**: `fetchTariffs` → карточки free/starter/pro/agency с ценами ★ и лимитами; кнопка «Оплатить» → callback-кнопка боту на invoice.
  - **Генератор**: чекбокс «Сохранить как шаблон» / выбор шаблона (`fetchTemplates`) → `applyTemplate` на стороне API через `template_id`.

- [ ] **Step 3: Проверить**
Run: `cd webapp; npm run typecheck; npm run build` → успех; браузер: тумблеры переключают features, канал добавляется/блокируется по лимиту, план 30 дней доступен Pro.

- [ ] **Step 4: Коммит**
```bash
git add webapp/src
git commit -m "feat: экраны каналы/настройки/план/тарифы/шаблоны в Mini App"
```

---

## Task 17: Скрипты деплоя

**Files:** Create/Modify: `supabase/scripts/deploy.ps1`, `webapp/package.json` (scripts).

- [ ] **Step 1: `supabase/scripts/deploy.ps1`** — задеплоить функции `telegram-bot`, `api`, `scheduler`; применить миграции 0001-0003; вывести инструкцию: назначить бота админом каналов вручную; подставить `<project-ref>` в cron; `BOT_TOKEN`/`OPENROUTER_API_KEY`/`FREE_DAILY_QUOTA` в env функции.

- [ ] **Step 2: vercel-скрипт для webapp** — `npm run deploy` (или инструкция сборки статики + загрузка). Валидация: `deploy.ps1` запускается без ошибок в окружении с `SUPABASE_ACCESS_TOKEN`.

- [ ] **Step 3: Коммит**
```bash
git add supabase/scripts webapp/package.json
git commit -m "chore: скрипты деплоя (функции, миграции, webapp)"
```

---

## Task 18: Финальная проверка полного проекта

**Files:** все.

- [ ] **Step 1: Полный прогон**
Run: `cd D:\Bots\reflectin\supabase; deno test --allow-read` → все зелёные.
Run: `cd D:\Bots\reflectin\webapp; npm run typecheck; npm run build` → успех.

- [ ] **Step 2: Ручная проверка**
- Браузер: Beams-фон, стартовый экран, генератор (+шаблоны), черновики, каналы (добавление/лимит), настройки (тумблеры), план 7/14/30, тарифы.
- Бот: /start, /gen, /fact (Pro), /tariffs, оплата Stars, модерация обсуждения, автоответы.
- Scheduler: pg_cron тик; автопостинг выкл → очередь стоит; отпуск → план публикуется, очередь не пополняется; подписчики записываются.

- [ ] **Step 3: Коммит**
```bash
git add -A
git commit -m "chore: финальная проверка полного проекта"
```

---

## Сводная проверка

```powershell
cd D:\Bots\reflectin\supabase
deno test --allow-read                          # все модули + scheduler + api + bot + SQL 0001-0003
cd D:\Bots\reflectin\webapp
npm run typecheck
npm run build
```

## Дефолты и кнопки для бота

- `/start` — приветствие + webapp.
- `/gen <тема>` — генерация по квоте (Этап 1).
- `/fact <тема>` — агент-режим (Task 14, Pro).
- `/tariffs` — тарифы и оплата (Task 15).
- Модерация/автоответы — обработчик сообщений в обсуждениях канала (Task 14).