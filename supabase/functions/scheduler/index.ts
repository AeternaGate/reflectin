import { handleTick } from "./handler.ts";
import { dbFromEnv } from "../_shared/db.ts";
import { resolveModels, completeWithFallback } from "../_shared/ai.ts";

function token() {
  return Deno.env.get("BOT_TOKEN") ?? "";
}

Deno.serve(async () => {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY") ?? "";
  const models = resolveModels(Deno.env.get("OPENROUTER_MODELS"));
  const base = `https://api.telegram.org/bot${token()}`;
  await handleTick({
    db: dbFromEnv(),
    generate: (prompt) =>
      completeWithFallback({ apiKey, models, messages: [{ role: "user", content: prompt }] }),
    sendMessage: async (chatId, text) => {
      const res = await fetch(`${base}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      return res.json();
    },
    getMemberCount: async (chatId) => {
      const res = await fetch(`${base}/getChatMemberCount`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId }),
      });
      const data = await res.json();
      return data.ok ? (data.result as number) : null;
    },
    nowIso: new Date().toISOString(),
  });
  return new Response("ok");
});