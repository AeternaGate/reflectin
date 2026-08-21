import { handleUpdate, type BotDeps } from "./handler.ts";
import { dbFromEnv } from "../_shared/db.ts";
import { resolveModels, completeWithFallback } from "../_shared/ai.ts";
import { PLAN_PRICES } from "../_shared/payments.ts";

function wireDeps(): BotDeps {
  const token = Deno.env.get("BOT_TOKEN") ?? "";
  const apiKey = Deno.env.get("OPENROUTER_API_KEY") ?? "";
  const models = resolveModels(Deno.env.get("OPENROUTER_MODELS"));
  const apiBase = `https://api.telegram.org/bot${token}`;
  const apiCall = (method: string, body: Record<string, unknown>): Promise<{ ok: boolean; result?: unknown }> =>
    fetch(`${apiBase}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());
  return {
    db: dbFromEnv(),
    freeQuota: Number(Deno.env.get("FREE_DAILY_QUOTA") ?? 2),
    webappUrl: Deno.env.get("WEBAPP_URL") ?? "",
    generate: (prompt) =>
      completeWithFallback({ apiKey, models, messages: [{ role: "user", content: prompt }] }),
    sendMessage: (chatId, text, opts) => apiCall("sendMessage", { chat_id: chatId, text, ...(opts ?? {}) }),
    deleteMessage: (chatId, messageId) =>
      apiCall("deleteMessage", { chat_id: chatId, message_id: messageId }),
    restrictChatMember: (chatId, userId) =>
      apiCall("restrictChatMember", {
        chat_id: chatId,
        user_id: userId,
        permissions: { can_send_messages: false, can_send_other_messages: false },
        until_date: Math.floor(Date.now() / 1000) + 3600,
      }),
    answerPreCheckout: (queryId, ok) =>
      apiCall("answerPreCheckoutQuery", { pre_checkout_query_id: queryId, ok }),
    sendInvoiceUrl: async (chatId, title, payload) => {
      const plan = payload.replace(/^plan:/, "");
      const amount = PLAN_PRICES[plan];
      if (!amount) return { ok: false };
      const inv = await apiCall("createInvoiceLink", {
        title,
        description: "Подписка Reflectin",
        payload,
        provider_token: "",
        currency: "XTR",
        prices: [{ label: title, amount }],
      });
      const url = typeof inv.result === "string" ? inv.result : null;
      if (!url) return inv;
      return apiCall("sendMessage", {
        chat_id: chatId,
        text: `Тариф ${title} — ${amount}★`,
        reply_markup: { inline_keyboard: [[{ text: `Оплатить ${amount}★`, url }]] },
      });
    },
  };
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("BOT_SECRET") ?? "";
  if (req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return new Response("forbidden", { status: 403 });
  }
  const update = await req.json().catch(() => null);
  if (update) {
    try {
      await handleUpdate(update, wireDeps());
    } catch (e) {
      console.error("webhook update failed", e);
    }
  }
  return new Response("ok", { status: 200 });
});
