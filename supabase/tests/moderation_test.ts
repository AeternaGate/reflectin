import { assertEquals } from "jsr:@std/assert";
import { stanceOf, classifyComment } from "../functions/_shared/moderation.ts";

Deno.test("stanceOf: позитивный комментарий", () => {
  assertEquals(stanceOf("Спасибо, очень полезно!"), "positive");
});

Deno.test("stanceOf: негативный комментарий", () => {
  assertEquals(stanceOf("Полная ерунда, бред какой-то"), "negative");
});

Deno.test("stanceOf: нейтральный комментарий", () => {
  assertEquals(stanceOf("Интересно, продолжай"), "neutral");
  assertEquals(stanceOf(""), "neutral");
});

Deno.test("classifyComment: ссылка в комментарии — спам", () => {
  const r = classifyComment("Купи тут https://spam.example - лучшие цены");
  assertEquals(r.spam, true);
});

Deno.test("classifyComment: обычный комментарий не спам", () => {
  const r = classifyComment("Отличный пост!");
  assertEquals(r.spam, false);
});