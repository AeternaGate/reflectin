import { assertEquals, assert } from "jsr:@std/assert";
import { handleApiRequest, type ApiDeps } from "../functions/api/handler.ts";
import { makeFakeDb } from "./fake_db.ts";
import { signInitData, userFields } from "./fake_initdata.ts";

const BOT_TOKEN = "test-token";
const today = new Date().toISOString().slice(0, 10);

async function signedReq(path: string, init: RequestInit = {}) {
  const s = await signInitData(userFields(777, "Dima"), BOT_TOKEN);
  return new Request(`https://x/functions/v1/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "x-init-data": s, ...(init.headers ?? {}) },
  });
}

function deps(over: Partial<ApiDeps> = {}) {
  const base: ApiDeps = {
    botToken: BOT_TOKEN,
    db: makeFakeDb({}),
    apiKey: "k",
    models: ["m/free"],
    freeQuota: 5,
    generate: async () => ({ text: "Пост", model: "m/free" }),
    ...over,
  };
  return base as ApiDeps;
}

Deno.test("OPTIONS — CORS-заголовки", async () => {
  const res = await handleApiRequest(new Request("https://x/functions/v1/api/quota", { method: "OPTIONS" }), deps());
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("без initData — 401", async () => {
  const res = await handleApiRequest(new Request("https://x/functions/v1/api/quota"), deps());
  assertEquals(res.status, 401);
});

Deno.test("плохой initData — 401", async () => {
  const req = new Request("https://x/functions/v1/api/quota", {
    headers: { "x-init-data": "hash=bad&auth_date=1" },
  });
  const res = await handleApiRequest(req, deps());
  assertEquals(res.status, 401);
});

Deno.test("GET /quota — счётчик и лимит", async () => {
  const rows = [
    { user_id: "id1", created_at: `${today}T09:00:00Z` },
    { user_id: "id1", created_at: `${today}T10:00:00Z` },
  ];
  const res = await handleApiRequest(await signedReq("/quota"), deps({ db: makeFakeDb({ generation_log: rows, users: [{ id: "id1", telegram_id: 777 }] }) }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.used, 2);
  assertEquals(body.free, 5);
  assert(body.rubrics.length === 4);
});

Deno.test("POST /gen без темы — 400", async () => {
  const res = await handleApiRequest(
    await signedReq("/gen", { method: "POST", body: JSON.stringify({ rubric: "польза" }) }),
    deps(),
  );
  assertEquals(res.status, 400);
});

Deno.test("POST /gen с неверной рубрикой — 400", async () => {
  const res = await handleApiRequest(
    await signedReq("/gen", { method: "POST", body: JSON.stringify({ topic: "x", rubric: "мемы" }) }),
    deps(),
  );
  assertEquals(res.status, 400);
});

Deno.test("POST /gen при исчерпанной квоте — 429", async () => {
  const rows = [
    { user_id: "id1", created_at: `${today}T09:00:00Z` },
    { user_id: "id1", created_at: `${today}T10:00:00Z` },
    { user_id: "id1", created_at: `${today}T11:00:00Z` },
    { user_id: "id1", created_at: `${today}T12:00:00Z` },
    { user_id: "id1", created_at: `${today}T13:00:00Z` },
  ];
  const res = await handleApiRequest(
    await signedReq("/gen", { method: "POST", body: JSON.stringify({ topic: "тема", rubric: "польза" }) }),
    deps({ db: makeFakeDb({ generation_log: rows, users: [{ id: "id1", telegram_id: 777 }] }) }),
  );
  assertEquals(res.status, 429);
});

Deno.test("POST /gen — пост, черновик и лог", async () => {
  const db = makeFakeDb({});
  const generate = async () => ({ text: "Готовый пост", model: "m/free" });
  const res = await handleApiRequest(
    await signedReq("/gen", { method: "POST", body: JSON.stringify({ topic: "отпуск", rubric: "польза" }) }),
    deps({ db, generate }),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.post, "Готовый пост");
  assert(db.calls.some((c) => c.startsWith("insert:posts")));
  assert(db.calls.some((c) => c.startsWith("insert:generation_log")));
});

Deno.test("GET /drafts — черновики юзера", async () => {
  const db = makeFakeDb({ posts: [{ id: "p1", user_id: "id1", content: "пост", rubric: "польза", created_at: "2026-08-20T10:00:00Z", status: "draft" }], users: [{ id: "id1", telegram_id: 777 }] });
  const res = await handleApiRequest(await signedReq("/drafts"), deps({ db }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.drafts.length, 1);
});

Deno.test("неизвестный путь — 404", async () => {
  const res = await handleApiRequest(await signedReq("/nope"), deps());
  assertEquals(res.status, 404);
});

// --- Task 13: каналы, настройки, контент-план, тарифы, тренды, шаблоны ---

function planOf(days: number) {
  const out: Array<{ day: number; rubric: string; topic: string }> = [];
  for (let i = 1; i <= days; i++) out.push({ day: i, rubric: "польза", topic: `Тема ${i}` });
  return out;
}

Deno.test("GET /me — возвращает план и лимиты", async () => {
  const db = makeFakeDb({ users: [{ id: "id1", telegram_id: 777, plan: "pro" }] });
  const res = await handleApiRequest(await signedReq("/me"), deps({ db }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.plan, "pro");
  assert(typeof body.limits.channels === "number");
  assert(typeof body.limits.quota === "number");
});

Deno.test("POST /channels — создаёт канал и роль владельца", async () => {
  const db = makeFakeDb({ users: [{ id: "id1", telegram_id: 777 }], channel_members: [], channels: [] });
  const res = await handleApiRequest(
    await signedReq("/channels", { method: "POST", body: JSON.stringify({ telegram_channel_id: "@kanal", title: "К" }) }),
    deps({ db }),
  );
  assertEquals(res.status, 200);
  assert(db.calls.some((c) => c.startsWith("insert:channels")), "нет insert в каналы");
  assert(db.calls.some((c) => c.startsWith("insert:channel_members")), "нет роли владельца");
  assertEquals(db.rows.channel_members[0].role, "owner");
});

Deno.test("POST /channels — блокирует сверх лимита плана", async () => {
  const db = makeFakeDb({
    users: [{ id: "id1", telegram_id: 777, plan: "free" }],
    channels: [
      { id: "c1", user_id: "id1" },
      { id: "c2", user_id: "id1" },
    ],
  });
  const res = await handleApiRequest(
    await signedReq("/channels", { method: "POST", body: JSON.stringify({ telegram_channel_id: "@x", title: "X" }) }),
    deps({ db }),
  );
  assertEquals(res.status, 403);
});

Deno.test("PATCH /channels/:id — переключает features владельцем", async () => {
  const db = makeFakeDb({ users: [{ id: "id1", telegram_id: 777 }], channels: [{ id: "ch1", user_id: "id1", features: {} }] });
  const res = await handleApiRequest(
    await signedReq("/channels/ch1", { method: "PATCH", body: JSON.stringify({ features: { autoposting: false } }) }),
    deps({ db }),
  );
  assertEquals(res.status, 200);
  assertEquals(db.rows.channels[0].features.autoposting, false);
});

Deno.test("PATCH /channels/:id — без роли editor → 403", async () => {
  const db = makeFakeDb({
    users: [{ id: "id1", telegram_id: 777 }],
    channels: [{ id: "ch9", user_id: "ownerX", features: {} }],
  });
  const res = await handleApiRequest(
    await signedReq("/channels/ch9", { method: "PATCH", body: JSON.stringify({ features: { autoposting: false } }) }),
    deps({ db }),
  );
  assertEquals(res.status, 403);
});

Deno.test("GET /plan?days=30 у free → 403", async () => {
  const db = makeFakeDb({ users: [{ id: "id1", telegram_id: 777, plan: "free" }] });
  const res = await handleApiRequest(await signedReq("/plan?days=30"), deps({ db }));
  assertEquals(res.status, 403);
});

Deno.test("GET /plan?days=7 у pro → ok (мок generate)", async () => {
  const db = makeFakeDb({ users: [{ id: "id1", telegram_id: 777, plan: "pro" }] });
  const generate = async () => ({ text: JSON.stringify(planOf(7)), model: "m/pro" });
  const res = await handleApiRequest(await signedReq("/plan?days=7"), deps({ db, generate }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.plan.length, 7);
});

Deno.test("GET /plan?days=14 у pro → ok (мок generate)", async () => {
  const db = makeFakeDb({ users: [{ id: "id1", telegram_id: 777, plan: "pro" }] });
  const generate = async () => ({ text: JSON.stringify(planOf(14)), model: "m/pro" });
  const res = await handleApiRequest(await signedReq("/plan?days=14"), deps({ db, generate }));
  assertEquals(res.status, 200);
});

Deno.test("POST /faq + GET /faq", async () => {
  const db = makeFakeDb({ users: [{ id: "id1", telegram_id: 777 }] });
  const post = await handleApiRequest(
    await signedReq("/faq?channel_id=c1", { method: "POST", body: JSON.stringify({ content: "База знаний" }) }),
    deps({ db }),
  );
  assertEquals(post.status, 200);
  const get = await handleApiRequest(await signedReq("/faq?channel_id=c1"), deps({ db }));
  assertEquals(get.status, 200);
  const body = await get.json();
  assertEquals(body.content, "База знаний");
});

Deno.test("POST /templates + GET /templates", async () => {
  const db = makeFakeDb({ users: [{ id: "id1", telegram_id: 777 }] });
  const post = await handleApiRequest(
    await signedReq("/templates", { method: "POST", body: JSON.stringify({ title: "Привет", content: "Шаблон {name}" }) }),
    deps({ db }),
  );
  assertEquals(post.status, 200);
  const get = await handleApiRequest(await signedReq("/templates"), deps({ db }));
  assertEquals(get.status, 200);
  const body = await get.json();
  assert(body.templates.length >= 1);
  assertEquals(body.templates[0].title, "Привет");
});

Deno.test("GET /trends — тренды из мониторинга (мок fetch)", async () => {
  const db = makeFakeDb({
    users: [{ id: "id1", telegram_id: 777 }],
    monitoring_channels: [{ id: "m1", channel_id: "c1", source: "https://feed.example/rss" }],
  });
  const feed = "<rss><channel><item><title>ИИ тренд</title><link>https://x/1</link></item><item><title>ИИ снова</title><link>https://x/2</link></item></channel></rss>";
  const fetchImpl = async () => new Response(feed, { status: 200 });
  const res = await handleApiRequest(await signedReq("/trends?channel_id=c1"), deps({ db, fetchImpl }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assert(body.trends?.length >= 1);
});

Deno.test("GET /trends — отключено в features → 403", async () => {
  const db = makeFakeDb({
    users: [{ id: "id1", telegram_id: 777 }],
    channels: [{ id: "c1", user_id: "id1", features: { trends: false } }],
  });
  const res = await handleApiRequest(await signedReq("/trends?channel_id=c1"), deps({ db }));
  assertEquals(res.status, 403);
});
