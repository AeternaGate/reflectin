export type Plan = "free" | "starter" | "pro" | "agency";

export interface PlanLimits { channels: number; quota: number }

const LIMITS: Record<Plan, PlanLimits> = {
  free: { channels: 2, quota: 2 },
  starter: { channels: 3, quota: 10 },
  pro: { channels: 5, quota: 50 },
  agency: { channels: 10, quota: 200 },
};

export function planLimits(plan: string): PlanLimits {
  return LIMITS[(plan as Plan) || "free"] ?? LIMITS.free;
}

export function dailyQuota(plan: string, freeDefault: number): number {
  return plan === "free" ? freeDefault : planLimits(plan).quota;
}

export const RUBRICS = ["польза", "история", "совет", "вопрос", "новость", "мнение"];

export interface PlanItem { day: number; rubric: string; topic: string }

export function validatePlan(
  items: PlanItem[] | null | undefined,
  days = 7,
): { ok: true } | { ok: false; error: string } {
  if (!Array.isArray(items)) return { ok: false, error: "не массив" };
  if (items.length !== days) return { ok: false, error: `нужно ${days} пунктов` };
  for (const it of items) {
    if (typeof it.day !== "number" || it.day < 1 || it.day > days) {
      return { ok: false, error: `неверный день ${it?.day}` };
    }
    if (typeof it.topic !== "string" || !it.topic.trim()) {
      return { ok: false, error: "пустая тема" };
    }
    if (!RUBRICS.includes(it.rubric)) {
      return { ok: false, error: `неизвестная рубрика ${it.rubric}` };
    }
  }
  return { ok: true };
}
