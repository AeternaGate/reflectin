import { assertEquals, assert } from "jsr:@std/assert";
import { matchFaq, shouldEscalate } from "../functions/_shared/autoreply.ts";

const FAQ = [
  { q: "сколько стоит", a: "Тарифы: 99, 299 и 749 звёзд" },
  { q: "как отменить", a: "Напишите поддержке" },
];

Deno.test("matchFaq: находит ответ по ключевому слову", () => {
  assertEquals(matchFaq("Сколько стоит ваш сервис?", FAQ), "Тарифы: 99, 299 и 749 звёзд");
});

Deno.test("matchFaq: нет совпадения — null", () => {
  assertEquals(matchFaq("Как работает генерация?", FAQ), null);
});

Deno.test("matchFaq: пустой вопрос — null", () => {
  assertEquals(matchFaq("", FAQ), null);
});

Deno.test("shouldEscalate: негатив + вопрос уходит агенту", () => {
  assert(shouldEscalate("Почему у меня всё сломалось, это ужасно", "negative"));
});

Deno.test("shouldEscalate: позитив не эскалируется", () => {
  assertEquals(shouldEscalate("Спасибо, работает", "positive"), false);
  assertEquals(shouldEscalate("Просто вопрос", "neutral"), false);
});