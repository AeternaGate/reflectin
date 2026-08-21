export const PLAN_PRICES: Record<string, number> = { starter: 199, pro: 499, agency: 999 };

export function starsByPlan(plan: string): number | null {
  return PLAN_PRICES[plan] ?? null;
}

export function planByStars(stars: number): string | null {
  const hit = Object.entries(PLAN_PRICES).find(([, s]) => s === stars);
  return hit ? hit[0] : null;
}
