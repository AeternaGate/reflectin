import { assertEquals, assert } from "jsr:@std/assert";
import { isEnabled } from "../functions/_shared/features.ts";

Deno.test("isEnabled: ключ включён явно — да", () => {
  assert(isEnabled({ autoposting: true }, "autoposting"));
});

Deno.test("isEnabled: ключ выключен явно — нет", () => {
  assertEquals(isEnabled({ autoposting: false }, "autoposting"), false);
});

Deno.test("isEnabled: отсутствует — фолбэк true по умолчанию", () => {
  assert(isEnabled({}, "autoposting"));
  assert(isEnabled(null, "autoposting"));
});

Deno.test("isEnabled: отсутствует с fallback=false — нет", () => {
  assertEquals(isEnabled({}, "moderation", false), false);
  assertEquals(isEnabled(null, "moderation", false), false);
});

Deno.test("isEnabled: другие ключи не влияют", () => {
  assert(isEnabled({ trends: false }, "autoposting"));
});