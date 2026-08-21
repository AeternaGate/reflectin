import { handleApiRequest, type ApiDeps } from "./handler.ts";
import { dbFromEnv } from "../_shared/db.ts";
import { resolveModels, completeWithFallback } from "../_shared/ai.ts";

Deno.serve((req) => {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY") ?? "";
  const deps: ApiDeps = {
    botToken: Deno.env.get("BOT_TOKEN") ?? "",
    db: dbFromEnv(),
    apiKey,
    models: resolveModels(Deno.env.get("OPENROUTER_MODELS")),
    freeQuota: Number(Deno.env.get("FREE_DAILY_QUOTA") ?? 2),
    generate: (prompt) =>
      completeWithFallback({ apiKey, models: deps.models, messages: [{ role: "user", content: prompt }] }),
    fetchImpl: fetch,
  };
  return handleApiRequest(req, deps);
});
