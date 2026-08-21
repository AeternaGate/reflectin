import { assertEquals, assert } from "jsr:@std/assert";
import { buildStyleBlock } from "../functions/_shared/style.ts";

Deno.test("buildStyleBlock: добавляет голос и частоту публикаций", () => {
  const b = buildStyleBlock({ voice: "дружелюбный", maxPostsPerDay: 2 });
  assert(b.includes("дружелюбный"));
  assert(b.includes("2"));
});

Deno.test("buildStyleBlock: пустой голос — дефолтное правило", () => {
  const b = buildStyleBlock({ voice: "", maxPostsPerDay: 1 });
  assertEquals(b.includes("дружелюбный"), false);
  assertEquals(b.includes("1"), true);
});

Deno.test("buildStyleBlock: стабилен для одного ввода", () => {
  const a = buildStyleBlock({ voice: "x", maxPostsPerDay: 3 });
  const b = buildStyleBlock({ voice: "x", maxPostsPerDay: 3 });
  assertEquals(a, b);
});