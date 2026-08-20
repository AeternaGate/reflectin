export interface DueRow {
  id: string;
  channel_id?: string;
  content: string;
  status: string;
  scheduled_at: string;
  priority: number;
}

export function pickDue(rows: DueRow[], nowIso: string): DueRow[] {
  return rows
    .filter((r) => r.status === "queued" && r.scheduled_at <= nowIso)
    .sort((a, b) => a.priority - b.priority || a.scheduled_at.localeCompare(b.scheduled_at));
}

export function shouldReplenish(count: number, fillTo = 5): boolean {
  return count < fillTo;
}

export function nextSlot(nowIso: string, quietHours: number[], postHour: number): string {
  for (let d = 0; d < 8; d++) {
    const dt = new Date(new Date(nowIso).getTime() + d * 86400000);
    const withHour = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), postHour, 0, 0));
    if (withHour.toISOString() > nowIso && !quietHours.includes(withHour.getUTCHours())) {
      return withHour.toISOString().replace(".000Z", "Z");
    }
  }
  return nowIso;
}
