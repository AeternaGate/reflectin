export type FeatureKey =
  | "autoposting"
  | "moderation"
  | "autoreply"
  | "agents"
  | "trends"
  | "templates";

export function isEnabled(
  features: Record<string, boolean> | null | undefined,
  key: string,
  fallback = true,
): boolean {
  return features?.[key] ?? fallback;
}
