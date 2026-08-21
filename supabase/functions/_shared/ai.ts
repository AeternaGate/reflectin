export const DEFAULT_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "inclusionai/ling-3.0-flash:free",
  "openai/gpt-oss-20b:free",
  "openrouter/free",
];

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

export function resolveModels(envModels?: string): string[] {
  const raw = envModels?.trim();
  if (!raw) return DEFAULT_MODELS;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export interface CompleteOptions {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  fetchImpl?: typeof fetch;
}

export async function complete(opts: CompleteOptions): Promise<string> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.8,
      max_tokens: opts.maxTokens ?? 900,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const body = await res.json();
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("OpenRouter: пустой ответ");
  return content;
}

export interface CompletionResult { text: string; model: string }

export async function completeWithFallback(opts: {
  apiKey: string;
  models: string[];
  messages: ChatMessage[];
  temperature?: number;
  fetchImpl?: typeof fetch;
}): Promise<CompletionResult> {
  const errors: string[] = [];
  for (const model of opts.models) {
    try {
      const text = await complete({ ...opts, model });
      return { text, model };
    } catch (e) {
      errors.push(`${model}: ${String(e)}`);
    }
  }
  throw new Error(`Все модели недоступны: ${errors.join("; ")}`);
}
