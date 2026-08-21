export type Stance = "positive" | "neutral" | "negative";

const POS: string[] = ["спасибо", "класс", "супер", "полезно", "отлично", "круто"];
const NEG: string[] = ["ерунда", "бред", "ужас", "плохо", "мусор", "не работает", "зря"];

export function stanceOf(text: string): Stance {
  const t = text.toLowerCase();
  const pos = POS.some((w) => t.includes(w));
  const neg = NEG.some((w) => t.includes(w));
  if (neg) return "negative";
  if (pos) return "positive";
  return "neutral";
}

export function classifyComment(text: string): { spam: boolean; stance: Stance } {
  return { spam: /https?:\/\//i.test(text), stance: stanceOf(text) };
}
