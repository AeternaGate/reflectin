import { assertEquals, assert } from "jsr:@std/assert";
import { pickDue, shouldReplenish, nextSlot } from "../functions/_shared/queue.ts";

const ROWS = [
  { id: "p1", channel_id: "ch1", content: "a", status: "queued", scheduled_at: "2026-08-20T08:00:00Z", priority: 1 },
  { id: "p2", channel_id: "ch1", content: "b", status: "queued", scheduled_at: "2026-08-20T09:00:00Z", priority: 2 },
  { id: "p3", channel_id: "ch1", content: "c", status: "queued", scheduled_at: "2026-08-20T10:00:00Z", priority: 1 },
  { id: "p4", channel_id: "ch1", content: "d", status: "published", scheduled_at: "2026-08-20T07:00:00Z", priority: 0 },
];

Deno.test("pickDue: берёт только queued-посты, срок которых уже наступил", () => {
  const due = pickDue(ROWS, "2026-08-20T10:30:00Z");
  assertEquals(due.map((r) => r.id), ["p1", "p3", "p2"]);
});

Deno.test("pickDue: сортирует по priority (младший — первым), потом по времени", () => {
  const due = pickDue(ROWS, "2026-08-20T23:00:00Z");
  const ids = due.map((r) => r.id);
  assertEquals(ids.indexOf("p1") < ids.indexOf("p2"), true);
  assertEquals(ids.indexOf("p1") < ids.indexOf("p3"), true);
  assertEquals(ids.indexOf("p3") < ids.indexOf("p2"), true);
});

Deno.test("pickDue: будущее не трогает, published исключает", () => {
  const due = pickDue(ROWS, "2026-08-20T07:30:00Z");
  assertEquals(due.map((r) => r.id), []);
  assertEquals(ROWS.some((r) => r.status === "published" && due.includes(r)), false);
});

Deno.test("pickDue: пустой список — пустой результат", () => {
  assertEquals(pickDue([], "2026-08-20T09:00:00Z"), []);
});

Deno.test("shouldReplenish: пополнять, если меньше fillTo", () => {
  assert(shouldReplenish(2, 5));
  assert(!shouldReplenish(5, 5));
  assert(!shouldReplenish(7, 5));
});

Deno.test("shouldReplenish: fillTo по умолчанию 5", () => {
  assert(shouldReplenish(4));
  assert(!shouldReplenish(5));
});

Deno.test("nextSlot: сегодня, если час ещё впереди и не в quiet hours", () => {
  assertEquals(nextSlot("2026-08-20T09:00:00Z", [], 10), "2026-08-20T10:00:00Z");
});

Deno.test("nextSlot: час уже прошёл — переносим на завтра", () => {
  assertEquals(nextSlot("2026-08-20T11:00:00Z", [], 10), "2026-08-21T10:00:00Z");
});

Deno.test("nextSlot: quiet hours не мешают, когда пост-час свободен", () => {
  assertEquals(nextSlot("2026-08-20T09:00:00Z", [11], 10), "2026-08-20T10:00:00Z");
});

Deno.test("nextSlot: пост-час в тихих часах — fallback на nowIso", () => {
  assertEquals(nextSlot("2026-08-20T09:00:00Z", [10], 10), "2026-08-20T09:00:00Z");
});