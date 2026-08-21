import { assertEquals, assert } from "jsr:@std/assert";
import {
  parseInitData,
  buildDataCheckString,
  deriveSecretKey,
  computeHash,
  validateInitData,
  initDataUser,
} from "../functions/_shared/initdata.ts";

async function signed(raw: string, botToken: string): Promise<string> {
  const fields = parseInitData(raw);
  const secret = await deriveSecretKey(botToken);
  const dcs = buildDataCheckString(fields);
  const hash = await computeHash(dcs, secret);
  return `${raw}&hash=${hash}`;
}

Deno.test("parseInitData: парсит query-строку в поля", () => {
  const f = parseInitData("auth_date=1662824122&first_name=Test&id=1&user={\"id\":42}");
  assertEquals(f["auth_date"], "1662824122");
  assertEquals(f["first_name"], "Test");
  assertEquals(f["user"], '{"id":42}');
});

Deno.test("buildDataCheckString: сортирует по ключу, hash исключается", () => {
  const f = { hash: "abc", auth_date: "10", first_name: "B", id: "1", last_name: "C" };
  assertEquals(buildDataCheckString(f), "auth_date=10\nfirst_name=B\nid=1\nlast_name=C");
});

Deno.test("validateInitData: валидная подпись приходит", async () => {
  const token = "test-token";
  const now = Math.floor(Date.now() / 1000);
  const raw = `auth_date=${now}&user=%7B%22id%22%3A42%7D`;
  const signedRaw = await signed(raw, token);
  assert(await validateInitData(signedRaw, token, 86400, now));
});

Deno.test("validateInitData: подделанные данные отклоняются", async () => {
  const token = "test-token";
  const now = Math.floor(Date.now() / 1000);
  const raw = `auth_date=${now}&user=%7B%22id%22%3A42%7D`;
  const signedRaw = await signed(raw, token);
  const tampered = signedRaw.replace("%7B%22id%22%3A42%7D", "%7B%22id%22%3A43%7D");
  assert(!(await validateInitData(tampered, token, 86400, now)));
});

Deno.test("validateInitData: чужой токен отклоняется", async () => {
  const now = Math.floor(Date.now() / 1000);
  const raw = `auth_date=${now}`;
  const signedRaw = await signed(raw, "token-a");
  assert(!(await validateInitData(signedRaw, "token-b", 86400, now)));
});

Deno.test("validateInitData: просроченная подпись отклоняется", async () => {
  const token = "test-token";
  const now = 1_700_000_000;
  const raw = `auth_date=${now - 90000}`; // больше 24ч
  const signedRaw = await signed(raw, token);
  assert(!(await validateInitData(signedRaw, token, 86400, now)));
});

Deno.test("validateInitData: отсутствие hash отклоняется", async () => {
  assert(!(await validateInitData("auth_date=1&user=%7B%22id%22%3A42%7D", "token", 86400)));
});

Deno.test("initDataUser: достаёт id пользователя", () => {
  const u = initDataUser("user=%7B%22id%22%3A42%2C%22first_name%22%3A%22Dima%22%7D&auth_date=1");
  assertEquals(u, { id: 42, first_name: "Dima" });
});

Deno.test("initDataUser: нет user — возвращает null", () => {
  assertEquals(initDataUser("auth_date=1"), null);
});