import { assertEquals, assert } from "jsr:@std/assert";
import {
  RUBRICS,
  RUBRIC_WEIGHTS,
  validatePlan,
  buildPostPrompt,
  RUBRIC_CAPTION,
} from "../functions/_shared/prompts.ts";

Deno.test("RUBRIC_WEIGHTS: рубрика польза доминирует (40/30/20/10)", () => {
  assertEquals(RUBRIC_WEIGHTS.польза, 40);
  assertEquals(RUBRIC_WEIGHTS.вовлечение, 30);
  assertEquals(RUBRIC_WEIGHTS.продажи, 20);
  assertEquals(RUBRIC_WEIGHTS.личное, 10);
  const sum = RUBRICS.reduce((s, r) => s + RUBRIC_WEIGHTS[r], 0);
  assertEquals(sum, 100);
});

Deno.test("validatePlan: валидный план проходит", () => {
  const items = [
    { day: 1, rubric: "польза", topic: "Как собрать отпуск в разгар лета" },
    { day: 2, rubric: "вовлечение", topic: "Опрос: где вы работаете?" },
  ];
  const r = validatePlan(items);
  assert(r.ok);
});

Deno.test("validatePlan: неверная рубрика отклоняется", () => {
  const items = [{ day: 1, rubric: "мемы", topic: "x" }];
  const r = validatePlan(items);
  assert(!r.ok);
});

Deno.test("validatePlan: пустая тема отклоняется", () => {
  const items = [{ day: 1, rubric: "польза", topic: "  " }];
  const r = validatePlan(items);
  assert(!r.ok);
});

Deno.test("validatePlan: дубликат дня отклоняется", () => {
  const items = [
    { day: 1, rubric: "польза", topic: "a" },
    { day: 1, rubric: "личное", topic: "b" },
  ];
  const r = validatePlan(items);
  assert(!r.ok);
});

Deno.test("validatePlan: не-массив отклоняется", () => {
  assert(!validatePlan("nope").ok);
  assert(!validatePlan(null).ok);
});

Deno.test("buildPostPrompt: содержит тему, рубрику и голос-правила", () => {
  const p = buildPostPrompt({ topic: "Отпуск", rubric: "польза", channelTitle: "Мой канал" });
  assert(p.includes("Отпуск"));
  assert(p.includes("польза"));
  assert(p.includes("эмодзи"));
  assert(p.includes(RUBRIC_CAPTION.польза));
});