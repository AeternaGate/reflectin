import { assertEquals, assert } from "jsr:@std/assert";
import { handleUpdate, type BotDeps } from "../functions/telegram-bot/handler.ts";
import { makeFakeDb } from "./fake_db.ts";

interface Sent { chat: number; text: string; opts?: Record<string, unknown> }

function deps(over: Partial<BotDeps> = {}) {
  const sends: Sent[] = [];
  const gens: string[] = [];
  const d: BotDeps = {
    db: makeFakeDb({}),
    freeQuota: 5,
    webappUrl: "https://app.example.com",
    generate: async (p) => { gens.push(p); return { text: "Сгенерированный пост", model: "m/free" }; },
    sendMessage: async (chat, text, opts) => { sends.push({ chat, text, opts }); return { ok: true }; },
    ...over,
  };
  return { deps: d, sends, gens };
}

const START_UPDATE = {
  message: { message_id: 1, chat: { id: 10 }, from: { id: 123, first_name: "Дима" }, text: "/start" },
};
const GEN_UPDATE = {
  message: { message_id: 2, chat: { id: 10 }, from: { id: 123, first_name: "Дима" }, text: "Напиши про отпуск" },
};

const today = new Date().toISOString().slice(0, 10);

Deno.test("на /start отвечает приветствием с webapp-кнопкой", async () => {
  const { deps: d, sends } = deps();
  await handleUpdate(START_UPDATE, d);
  assert(sends.length === 1);
  assert(sends[0].text.includes("Reflectin"));
  assert(JSON.stringify(sends[0].opts).includes(d.webappUrl));
});

Deno.test("текстовое сообщение — генерация + черновик + лог", async () => {
  const db = makeFakeDb({});
  const { deps: d, sends, gens } = deps({ db });
  const r = await handleUpdate(GEN_UPDATE, d);
  assertEquals(r, "post");
  assert(gens.length === 1);
  assert(gens[0].includes("отпуск"));
  assert(sends[0].text === "Сгенерированный пост");
  assert(db.calls.some((c) => c.startsWith("insert:posts")));
  assert(db.calls.some((c) => c.startsWith("insert:generation_log")));
});

Deno.test("квота исчерпана — не генерируем, отвечаем", async () => {
  const rows = Array.from({ length: 5 }).map((_, i) => ({
    user_id: "u1", feature: "post", model: "m", created_at: `${today}T0${i}:00:00Z`,
  }));
  const db = makeFakeDb({ generation_log: rows, users: [{ id: "u1", telegram_id: 123 }] });
  const { deps: d, sends, gens } = deps({ db });
  const r = await handleUpdate(GEN_UPDATE, d);
  assertEquals(r, "quota");
  assert(gens.length === 0);
  assert(sends[0].text.includes("лимит"));
});

Deno.test("не-сообщение — null", async () => {
  const { deps: d, gens } = deps();
  const r = await handleUpdate({ edited_message: {} }, d);
  assertEquals(r, null);
  assert(gens.length === 0);
});

const FACT_UPDATE = {
  message: { message_id: 3, chat: { id: 10 }, from: { id: 123, first_name: "Дима" }, text: "/fact отпуск" },
};

Deno.test("/fact у Pro — pipeline агентов, 1 запись квоты, черновик", async () => {
  const db = makeFakeDb({ users: [{ id: "u1", telegram_id: 123, plan: "pro" }] });
  const { deps: d, sends, gens } = deps({ db });
  const r = await handleUpdate(FACT_UPDATE, d);
  assertEquals(r, "agent");
  assertEquals(gens.length, 3, "research → writer → editor");
  assert(gens[0].includes("отпуск"));
  assertEquals(db.calls.filter((c) => c.startsWith("insert:generation_log")).length, 1, "один пост = одна единица квоты");
  assert(db.calls.some((c) => c.startsWith("insert:posts")));
  assert(sends.some((s) => s.text === "Сгенерированный пост"));
});

Deno.test("/fact у free — отказ, генерации нет", async () => {
  const db = makeFakeDb({ users: [{ id: "u1", telegram_id: 123, plan: "free" }] });
  const { deps: d, sends, gens } = deps({ db });
  const r = await handleUpdate(FACT_UPDATE, d);
  assertEquals(r, "agent");
  assertEquals(gens.length, 0);
  assert(sends[0].text.includes("Pro"), "ожидалось сообщение про тариф Pro");
  assertEquals(db.calls.filter((c) => c.startsWith("insert:generation_log")).length, 0);
});

Deno.test("/fact без темы — подсказка", async () => {
  const { deps: d, sends, gens } = deps();
  const r = await handleUpdate(
    { message: { message_id: 4, chat: { id: 10 }, from: { id: 123, first_name: "Дима" }, text: "/fact" } },
    d,
  );
  assertEquals(r, "agent");
  assertEquals(gens.length, 0);
  assert(sends[0].text.includes("/fact"));
});

Deno.test("спам-ссылка в обсуждении — удаление и рестрикт", async () => {
  const db = makeFakeDb({
    channels: [{ id: "c1", user_id: "u1", telegram_channel_id: -100123, features: { moderation: true } }],
  });
  const deleted: Array<[number, number]> = [];
  const restricted: Array<[number, number]> = [];
  const { deps: d } = deps({
    db,
    deleteMessage: async (chat, mid) => {
      deleted.push([chat, mid]);
      return { ok: true };
    },
    restrictChatMember: async (chat, uid) => {
      restricted.push([chat, uid]);
      return { ok: true };
    },
  });
  const r = await handleUpdate(
    {
      message: {
        message_id: 7,
        chat: { id: -100123, type: "supergroup" },
        from: { id: 55, first_name: "Спамер" },
        text: "Купи тут https://spam.example",
      },
    },
    d,
  );
  assertEquals(r, "moderate");
  assertEquals(deleted, [[-100123, 7]]);
  assertEquals(restricted, [[-100123, 55]]);
});

Deno.test("вопрос из базы знаний — автоответ", async () => {
  const db = makeFakeDb({
    channels: [{ id: "c1", user_id: "u1", telegram_channel_id: -100123, features: { autoreply: true } }],
    knowledge_base: [{ id: "k1", channel_id: "c1", content: "цена стоит 500 звёзд" }],
  });
  const { deps: d, sends } = deps({ db });
  const r = await handleUpdate(
    {
      message: {
        message_id: 8,
        chat: { id: -100123 },
        from: { id: 55, first_name: "Клиент" },
        text: "а сколько стоит подписка?",
      },
    },
    d,
  );
  assertEquals(r, "autoreply");
  assert(sends.some((s) => s.text.includes("цена")), "ожидался ответ из базы знаний");
});

Deno.test("сообщение самого бота в группе игнорируется", async () => {
  const db = makeFakeDb({
    channels: [{ id: "c1", user_id: "u1", telegram_channel_id: -100123, features: { moderation: true } }],
  });
  const { deps: d } = deps({
    db,
    deleteMessage: async () => {
      throw new Error("deleteMessage не должен вызываться");
    },
  });
  const r = await handleUpdate(
    {
      message: {
        message_id: 9,
        chat: { id: -100123 },
        from: { id: 55, is_bot: true, first_name: "Бот" },
        text: "https://spam.example",
      },
    },
    d,
  );
  assertEquals(r, null);
});

Deno.test("pre_checkout — подтверждаем оплату", async () => {
  const answered: Array<[string, boolean]> = [];
  const { deps: d } = deps({
    answerPreCheckout: async (id, ok) => {
      answered.push([id, ok]);
      return { ok };
    },
  });
  const r = await handleUpdate(
    { pre_checkout_query: { id: "pc1", currency: "XTR", total_amount: 499, invoice_payload: "plan:pro" } },
    d,
  );
  assertEquals(answered, [["pc1", true]]);
});

Deno.test("successful_payment — активирует тариф по payload", async () => {
  const db = makeFakeDb({ users: [{ id: "u1", telegram_id: 123, plan: "free" }] });
  const { deps: d, sends } = deps({ db });
  const r = await handleUpdate(
    {
      message: {
        message_id: 10,
        chat: { id: 10 },
        from: { id: 123, first_name: "Дима" },
        successful_payment: { currency: "XTR", total_amount: 499, invoice_payload: "plan:pro" },
      },
    },
    d,
  );
  assertEquals(r, "payment");
  assertEquals(db.rows.users[0].plan, "pro");
  assert(sends.some((s) => s.text.includes("PRO")));
});

Deno.test("/tariffs — инвойс на каждый платный тариф", async () => {
  const invoices: string[] = [];
  const { deps: d } = deps({
    sendInvoiceUrl: async (_chat, _title, payload) => {
      invoices.push(payload);
      return { ok: true };
    },
  });
  const r = await handleUpdate(
    { message: { message_id: 11, chat: { id: 10 }, from: { id: 123, first_name: "Дима" }, text: "/tariffs" } },
    d,
  );
  assertEquals(r, "tariffs");
  assertEquals(invoices.sort(), ["plan:agency", "plan:pro", "plan:starter"]);
});
