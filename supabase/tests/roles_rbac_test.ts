import { assertEquals, assert } from "jsr:@std/assert";
import { atLeast, ROLE_LEVEL } from "../functions/_shared/roles.ts";

Deno.test("ROLE_LEVEL: owner выше редактора, редактор выше модератора", () => {
  assert(ROLE_LEVEL.owner > ROLE_LEVEL.editor);
  assert(ROLE_LEVEL.editor > ROLE_LEVEL.moderator);
});

Deno.test("atLeast: нужный уровень доступен модератору и выше", () => {
  assert(atLeast("owner", "moderator"));
  assert(atLeast("editor", "moderator"));
  assert(atLeast("moderator", "moderator"));
});

Deno.test("atLeast: недостаточный уровень отклоняется", () => {
  assertEquals(atLeast("moderator", "owner"), false);
  assertEquals(atLeast("editor", "owner"), false);
  assertEquals(atLeast("member", "moderator"), false);
});

Deno.test("atLeast: неизвестная роль не проходит", () => {
  assertEquals(atLeast("stranger", "moderator"), false);
});