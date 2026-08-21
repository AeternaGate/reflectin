import { assertEquals, assert } from "jsr:@std/assert";
import { safeJsonParse, extractJson, isJsonObject } from "../functions/_shared/json.ts";

Deno.test("safeJsonParse: парсит валидный JSON", () => {
  assertEquals(safeJsonParse('{"a":1}'), { a: 1 });
});

Deno.test("safeJsonParse: не бросает на мусоре, возвращает fallback", () => {
  assertEquals(safeJsonParse("not json"), null);
  assertEquals(safeJsonParse(""), null);
  assertEquals(safeJsonParse('{"broken"', 42), 42);
});

Deno.test("extractJson: вытаскивает объект из кода-фенса LLM", () => {
  const out = extractJson('```json\n{"a":1}\n```');
  assertEquals(out, { a: 1 });
});

Deno.test("extractJson: вытаскивает объект из текста вокруг", () => {
  const out = extractJson('Вот результат: {"a":1} конец.');
  assertEquals(out, { a: 1 });
});

Deno.test("extractJson: вытаскивает массив", () => {
  const out = extractJson('план: [{"day":1},{"day":2}]');
  assert(Array.isArray(out) && out.length === 2);
});

Deno.test("extractJson: возвращает null если JSON нет", () => {
  assertEquals(extractJson("просто текст без json"), null);
});

Deno.test("isJsonObject: отличает объект от прочего", () => {
  assert(isJsonObject({}));
  assert(!isJsonObject(null));
  assert(!isJsonObject([1]));
  assert(!isJsonObject("x"));
});