export function safeJsonParse(text: string, fallback: unknown = null): unknown {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export function isJsonObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Вытаскивает первый JSON-объект или массив из текста LLM (в т.ч. из ```json-фенсов). */
export function extractJson(text: string): unknown {
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) {
    try {
      return JSON.parse(obj[0]);
    } catch {
      /* падаем на массив */
    }
  }
  const arr = text.match(/\[[\s\S]*\]/);
  if (arr) {
    try {
      return JSON.parse(arr[0]);
    } catch {
      return null;
    }
  }
  return null;
}
