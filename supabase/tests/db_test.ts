import { assertEquals, assert } from "jsr:@std/assert";
import { quotaUsedToday, getOrCreateUser, insertPost, logGeneration, getDrafts } from "../functions/_shared/db.ts";
import { makeFakeDb } from "./fake_db.ts";

const SEED = {
  generation_log: [
    { user_id: "u1", feature: "post", model: "m", created_at: "2026-08-20T08:00:00Z" },
    { user_id: "u1", feature: "post", model: "m", created_at: "2026-08-20T09:00:00Z" },
    { user_id: "u1", feature: "plan", model: "m", created_at: "2026-08-19T09:00:00Z" },
  ],
  posts: [
    { id: "p1", user_id: "u2", content: "пост", rubric: "польза", status: "draft" },
  ],
};

Deno.test("quotaUsedToday: считает только записи выбранной даты", async () => {
  const db = makeFakeDb(SEED);
  const n = await quotaUsedToday(db, "u1", "2026-08-20");
  assertEquals(n, 2);
  assertEquals(db.calls[0], "from:generation_log");
});

Deno.test("quotaUsedToday: другого дня — ноль", async () => {
  const n = await quotaUsedToday(makeFakeDb(SEED), "u1", "2026-08-21");
  assertEquals(n, 0);
});

Deno.test("getOrCreateUser: создаёт при отсутствии и возвращает id", async () => {
  const db = makeFakeDb({ users: [] });
  const u = await getOrCreateUser(db, 123, "Dima");
  assert(u.id);
  assert(db.calls.some((c) => c === "insert:users:first_name,telegram_id"));
});

Deno.test("getOrCreateUser: возвращает существующего", async () => {
  const db = makeFakeDb({ users: [{ id: "u1", telegram_id: 123 }] });
  const u = await getOrCreateUser(db, 123, "Dima");
  assertEquals(u.id, "u1");
});

Deno.test("insertPost: вставляет пост и возвращает id", async () => {
  const db = makeFakeDb({ posts: [] });
  const id = await insertPost(db, { user_id: "u1", content: "текст", status: "draft" });
  assert(id);
  assert(db.calls.some((c) => c.startsWith("insert:posts")));
});

Deno.test("logGeneration: логирует генерацию", async () => {
  const db = makeFakeDb({ generation_log: [] });
  await logGeneration(db, { user_id: "u1", model: "m/free", feature: "post" });
  assert(db.calls.some((c) => c.startsWith("insert:generation_log")));
});

Deno.test("getDrafts: возвращает черновики пользователя", async () => {
  const db = makeFakeDb(SEED);
  const drafts = await getDrafts(db, "u2");
  assertEquals(drafts.length, 1);
  assertEquals(drafts[0].id, "p1");
});