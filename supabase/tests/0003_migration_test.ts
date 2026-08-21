import { assert } from "jsr:@std/assert";

const SQL_PATH = new URL("../migrations/0003_modules.sql", import.meta.url);

const REQUIRED = {
  "public.channel_members": ["channel_id", "user_id", "role"],
  "public.knowledge_base": ["channel_id", "content"],
  "public.monitoring_channels": ["channel_id", "source"],
  "public.templates": ["user_id", "name", "content"],
  "public.agent_log": ["user_id", "agent", "status"],
  "public.stars_invoices": ["user_id", "amount", "status"],
};

const REMOVED = ["public.team_members", "public.moderation_blacklist"];

Deno.test("0003_modules.sql: создаёт все таблицы модулей Этапа 2+", async () => {
  const sql = await Deno.readTextFile(SQL_PATH);
  for (const [table, cols] of Object.entries(REQUIRED)) {
    assert(sql.includes(`create table ${table}`), `нет таблицы ${table}`);
    for (const c of cols) {
      assert(sql.includes(`  ${c} `) || sql.includes(`  ${c}\t`), `нет колонки ${c} в ${table}`);
    }
  }
  for (const dead of REMOVED) {
    assert(!sql.includes(`create table ${dead}`), `мёртвая таблица ${dead} не должна создаваться`);
  }
});