import { assert } from "jsr:@std/assert";

const SQL_PATH = new URL("../migrations/0001_init.sql", import.meta.url);

const REQUIRED = {
  "public.users": ["telegram_id", "first_name", "plan", "created_at"],
  "public.channels": ["user_id", "telegram_channel_id", "title"],
  "public.posts": ["user_id", "content", "rubric", "status"],
  "public.generation_log": ["user_id", "feature", "model", "created_at"],
};

Deno.test("0001_init.sql: создаёт все 4 таблицы с ключевыми колонками", async () => {
  const sql = await Deno.readTextFile(SQL_PATH);
  for (const [table, cols] of Object.entries(REQUIRED)) {
    assert(sql.includes(`create table ${table}`), `нет таблицы ${table}`);
    for (const c of cols) {
      assert(sql.includes(`  ${c} `) || sql.includes(`  ${c}\t`), `нет колонки ${c} в ${table}`);
    }
  }
});

Deno.test("0001_init.sql: generation_log индексирован по (user_id, created_at)", () => {
  const sql = Deno.readTextFileSync(SQL_PATH);
  assert(sql.includes("idx_generation_log_user_date"));
  assert(sql.includes("user_id, created_at"));
});