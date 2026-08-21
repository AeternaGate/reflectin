import { assertEquals, assert } from "jsr:@std/assert";
import { validatePlan, planLimits, type PlanLimits } from "../functions/_shared/plans.ts";

Deno.test("validatePlan: 7 дней проходит", () => {
  const items = Array.from({ length: 7 }, (_, i) => ({ day: i + 1, rubric: "польза", topic: `Тема ${i}` }));
  const r = validatePlan(items, 7);
  assert(r.ok);
});

Deno.test("validatePlan: 30 дней проходит", () => {
  const items = Array.from({ length: 30 }, (_, i) => ({ day: i + 1, rubric: "польза", topic: `Тема ${i}` }));
  const r = validatePlan(items, 30);
  assert(r.ok);
});

Deno.test("validatePlan: превышение длины — ошибка", () => {
  const items = Array.from({ length: 8 }, (_, i) => ({ day: i + 1, rubric: "польза", topic: `Тема ${i}` }));
  assertEquals(validatePlan(items, 7).ok, false);
});

Deno.test("validatePlan: неверный день/рубрика — ошибка", () => {
  const items = [{ day: 99, rubric: "польза", topic: "x" }];
  assertEquals(validatePlan(items, 7).ok, false);
  const items2 = [{ day: 1, rubric: "мемы", topic: "x" }];
  assertEquals(validatePlan(items2, 7).ok, false);
});

Deno.test("validatePlan: пустой или не массив — ошибка", () => {
  assertEquals(validatePlan([], 7).ok, false);
  assertEquals(validatePlan(null, 7).ok, false);
});

Deno.test("planLimits: лимиты по ТЗ", () => {
  assertEquals(planLimits("free"), { channels: 2, quota: 2 });
  assertEquals(planLimits("starter"), { channels: 3, quota: 10 });
  assertEquals(planLimits("pro"), { channels: 5, quota: 50 });
  assertEquals(planLimits("agency"), { channels: 10, quota: 200 });
});

Deno.test("planLimits: неизвестный план — free", () => {
  assertEquals(planLimits("god"), planLimits("free"));
});