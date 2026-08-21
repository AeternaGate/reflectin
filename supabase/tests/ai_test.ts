import { assertEquals, assert } from "jsr:@std/assert";
import { resolveModels, completeWithFallback, complete, DEFAULT_MODELS } from "../functions/_shared/ai.ts";

function fakeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

let callLog: string[] = [];

function makeFetch(script: Array<{ status: number; body: unknown }>) {
  let i = 0;
  const fake = async (url: string | URL | Request, init?: RequestInit & { body?: string }): Promise<Response> => {
    const body = (init && typeof init.body === "string") ? init.body : "";
    const parsed = JSON.parse(body || "{}");
    callLog.push(`${parsed.model ?? "?"}:${script[i].status}`);
    const out = fakeResponse(script[i].status, script[i].body);
    i += 1;
    return out;
  };
  return fake as typeof fetch;
}

Deno.test("resolveModels: без env — дефолтный ростер", () => {
  assertEquals(resolveModels(undefined), DEFAULT_MODELS);
  assert(DEFAULT_MODELS.length >= 2);
});

Deno.test("resolveModels: env разбивается по запятой", () => {
  assertEquals(resolveModels("a/b:free, c/d:free "), ["a/b:free", "c/d:free"]);
});

Deno.test("resolveModels: env-пусто откатывается на дефолт", () => {
  assertEquals(resolveModels(""), DEFAULT_MODELS);
});

Deno.test("complete: шлёт POST в OpenRouter и возвращает текст", async () => {
  const fetchImpl = makeFetch([{ status: 200, body: { choices: [{ message: { content: "Привет" } }] } }]);
  const text = await complete({
    apiKey: "key",
    model: "m/free",
    messages: [{ role: "user", content: "hi" }],
    fetchImpl,
  });
  assertEquals(text, "Привет");
  assertEquals(callLog, ["m/free:200"]);
});

Deno.test("complete: 429 — бросает", async () => {
  const fetchImpl = makeFetch([{ status: 429, body: {} }]);
  let threw = "";
  try {
    await complete({ apiKey: "key", model: "m/free", messages: [], fetchImpl });
  } catch (e) {
    threw = String(e);
  }
  assert(threw.includes("429"));
});

Deno.test("completeWithFallback: успех на первой модели", async () => {
  const fetchImpl = makeFetch([{ status: 200, body: { choices: [{ message: { content: "ok" } }] } }]);
  const { text, model } = await completeWithFallback({
    apiKey: "key",
    models: ["m1", "m2"],
    messages: [{ role: "user", content: "x" }],
    fetchImpl,
  });
  assertEquals(text, "ok");
  assertEquals(model, "m1");
});

Deno.test("completeWithFallback: падает на первой — берёт вторую", async () => {
  const fetchImpl = makeFetch([
    { status: 429, body: {} },
    { status: 200, body: { choices: [{ message: { content: "fallback-текст" } }] } },
  ]);
  const { text, model } = await completeWithFallback({
    apiKey: "key",
    models: ["m1", "m2"],
    messages: [],
    fetchImpl,
  });
  assertEquals(model, "m2");
  assertEquals(text, "fallback-текст");
});

Deno.test("completeWithFallback: все модели упали — бросает", async () => {
  const fetchImpl = makeFetch([
    { status: 429, body: {} },
    { status: 500, body: {} },
  ]);
  let threw = false;
  try {
    await completeWithFallback({ apiKey: "key", models: ["m1", "m2"], messages: [], fetchImpl });
  } catch {
    threw = true;
  }
  assert(threw);
});