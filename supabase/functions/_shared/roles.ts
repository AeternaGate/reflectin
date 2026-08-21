export const ROLE_LEVEL: Record<string, number> = { moderator: 1, editor: 2, owner: 3 };

export function atLeast(role: string, min: string): boolean {
  return (ROLE_LEVEL[role] ?? 0) >= (ROLE_LEVEL[min] ?? 0);
}
