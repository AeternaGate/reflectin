export interface FaqEntry { q: string; a: string }

export function matchFaq(text: string, faq: FaqEntry[]): string | null {
  const t = text.toLowerCase();
  for (const e of faq) {
    if (t.includes(e.q.toLowerCase())) return e.a;
  }
  return null;
}

const QUESTION_WORDS = ["почему", "зачем", "что", "как", "когда", "где", "кто", "куда", "откуда", "можно", "стоит ли"];

export function shouldEscalate(text: string, stance: string): boolean {
  const t = text.toLowerCase();
  return stance === "negative" && (t.includes("?") || QUESTION_WORDS.some((w) => t.includes(w)));
}
