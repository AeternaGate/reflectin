import { assert } from "jsr:@std/assert";

const SQL_PATH = new URL("../migrations/0002_schedule.sql", import.meta.url);

Deno.test("0002_schedule.sql: расширяет posts полями планирования", async () => {
  const sql = await Deno.readTextFile(SQL_PATH);
  for (const col of ["scheduled_at", "priority", "published_at"]) {
    assert(sql.includes(`${col}`), `нет колонки ${col}`);
  }
});

Deno.test("0002_schedule.sql: добавляет индекс на (channel_id, status, scheduled_at)", async () => {
  const sql = await Deno.readTextFile(SQL_PATH);
  assert(sql.includes("idx_posts_due"));
  assert(sql.includes("channel_id, status, scheduled_at"));
});

Deno.test("0002_schedule.sql: расширяет channels расписанием, фичами и отпуском", async () => {
  const sql = await Deno.readTextFile(SQL_PATH);
  for (const col of ["quiet_hours", "max_posts_per_day", "post_hour", "features", "vacation_from", "vacation_to"]) {
    assert(sql.includes(col), `нет колонки ${col}`);
  }
});

Deno.test("0002_schedule.sql: posts имеют счётчики вовлечённости", async () => {
  const sql = await Deno.readTextFile(SQL_PATH);
  for (const col of ["reactions", "subscribers"]) {
    assert(sql.includes(col), `нет колонки ${col} в posts`);
  }
});