import { assertEquals, assert } from "jsr:@std/assert";
import { handleTick, type SchedulerDeps } from "../functions/scheduler/handler.ts";
import { makeFakeDb } from "./fake_db.ts";

const GEN = { text: "Сгенерированный пост", model: "m/free" };
const BASE = {
  nowIso: "2026-08-20T12:00:00Z",
  fillTo: 5,
  postHour: 10,
  quietHours: [],
};

function deps(extra: Partial<SchedulerDeps> & { db: ReturnType<typeof makeFakeDb> }): SchedulerDeps {
  return {
    ...BASE,
    generate: async () => GEN,
    sendMessage: async () => ({ ok: true }) as unknown as Response,
    ...extra,
  };
}

Deno.test("handleTick: публикует due-посты и обновляет статус", async () => {
  const db = makeFakeDb({
    channels: [{ id: "ch1", user_id: "u1", title: "Канал", telegram_channel_id: 111 }],
    posts: [
      { id: "p1", user_id: "u1", channel_id: "ch1", content: "пост 1", rubric: "польза", status: "queued", scheduled_at: "2026-08-20T10:00:00Z", priority: 1 },
      { id: "p2", user_id: "u1", channel_id: "ch1", content: "пост 2", rubric: "польза", status: "queued", scheduled_at: "2026-08-21T10:00:00Z", priority: 1 },
    ],
  });
  let sent: Array<[number, string]> = [];
  const r = await handleTick(deps({
    db,
    sendMessage: async (chatId: number, text: string) => { sent.push([chatId, text]); },
  }));
  assertEquals(sent, [[111, "пост 1"]]);
  assertEquals(r.published, 1);
  assertEquals(db.rows.posts.find((p) => p.id === "p1")?.status, "published");
  assertEquals(db.rows.posts.find((p) => p.id === "p2")?.status, "queued");
});

Deno.test("handleTick: пополняет очередь, если queued меньше fillTo", async () => {
  const db = makeFakeDb({
    channels: [{ id: "ch1", user_id: "u1", title: "Канал", telegram_channel_id: 111 }],
    posts: [
      { id: "p1", user_id: "u1", channel_id: "ch1", content: "x", rubric: "польза", status: "queued", scheduled_at: "2026-08-21T10:00:00Z", priority: 1 },
    ],
  });
  const r = await handleTick(deps({ db }));
  assert(r.replenished >= 1);
  const queued = db.rows.posts.filter((p) => p.status === "queued");
  assertEquals(queued.length, BASE.fillTo);
});

Deno.test("handleTick: не пополняет, если очередь полна", async () => {
  const db = makeFakeDb({
    channels: [{ id: "ch1", user_id: "u1", title: "Канал", telegram_channel_id: 111 }],
    posts: [
      { id: "p1", user_id: "u1", channel_id: "ch1", content: "x", rubric: "польза", status: "queued", scheduled_at: "2026-08-21T10:00:00Z", priority: 1 },
      { id: "p2", user_id: "u1", channel_id: "ch1", content: "x", rubric: "польза", status: "queued", scheduled_at: "2026-08-22T10:00:00Z", priority: 1 },
      { id: "p3", user_id: "u1", channel_id: "ch1", content: "x", rubric: "польза", status: "queued", scheduled_at: "2026-08-23T10:00:00Z", priority: 1 },
      { id: "p4", user_id: "u1", channel_id: "ch1", content: "x", rubric: "польза", status: "queued", scheduled_at: "2026-08-24T10:00:00Z", priority: 1 },
      { id: "p5", user_id: "u1", channel_id: "ch1", content: "x", rubric: "польза", status: "queued", scheduled_at: "2026-08-25T10:00:00Z", priority: 1 },
    ],
  });
  const r = await handleTick(deps({ db }));
  assertEquals(r.replenished, 0);
  assertEquals(db.rows.posts.filter((p) => p.status === "queued").length, 5);
});

Deno.test("handleTick: новый пост откладывается на postHour не раньше завтра", async () => {
  const db = makeFakeDb({
    channels: [{ id: "ch1", user_id: "u1", title: "Канал", telegram_channel_id: 111 }],
    knowledge_base: [],
    posts: [],
  });
  await handleTick(deps({ db }));
  const p = db.rows.posts.find((x) => x.status === "queued");
  assert(p, "очередь должна пополниться");
  const hour = new Date(p.scheduled_at).getUTCHours();
  assertEquals(hour, 10);
});