export const RUBRICS = ["польза", "вовлечение", "продажи", "личное"] as const;
export type Rubric = (typeof RUBRICS)[number];

export const RUBRIC_WEIGHTS: Record<Rubric, number> = {
  польза: 40,
  вовлечение: 30,
  продажи: 20,
  личное: 10,
};

export const RUBRIC_CAPTION: Record<Rubric, string> = {
  польза: "дай конкретную пользу: инструкция, лайфхак, шаблон",
  вовлечение: "вовлекай: вопрос, опрос, история с интригой",
  продажи: "мягкая продажа: покажи результат и призыв к действию",
  личное: "личное из жизни автора: эмоция и честность",
};

export interface PlanItem { day: number; rubric: Rubric; topic: string }
export type PlanResult =
  | { ok: true; plan: PlanItem[] }
  | { ok: false; reason: string };

const VALID_DAYS = [1, 2, 3, 4, 5, 6, 7];

export function validatePlan(items: unknown): PlanResult {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, reason: "план пуст или не массив" };
  }
  const seen = new Set<number>();
  for (const it of items) {
    if (it === null || typeof it !== "object") return { ok: false, reason: "элемент не объект" };
    const item = it as Record<string, unknown>;
    const day = Number(item.day);
    if (!VALID_DAYS.includes(day)) return { ok: false, reason: `неверный день: ${item.day}` };
    if (seen.has(day)) return { ok: false, reason: `день повторяется: ${item.day}` };
    seen.add(day);
    if (!RUBRICS.includes(item.rubric as Rubric)) return { ok: false, reason: `неверная рубрика: ${item.rubric}` };
    if (typeof item.topic !== "string" || item.topic.trim().length === 0) {
      return { ok: false, reason: `пустая тема в день ${item.day}` };
    }
  }
  return { ok: true, plan: items as PlanItem[] };
}

export function buildPostPrompt(opts: { topic: string; rubric: Rubric; channelTitle?: string }): string {
  return [
    `Ты — редактор телеграм-канала «${opts.channelTitle ?? "Без названия"}».`,
    `Напиши пост в рубрике «${opts.rubric}»: ${RUBRIC_CAPTION[opts.rubric]}.`,
    "Правила: без эмодзи, короткие абзацы, заголовок-крючок первым делом, живой голос автора.",
    `Тема: ${opts.topic}`,
    "Верни ТОЛЬКО текст поста без комментариев.",
  ].join("\n");
}
