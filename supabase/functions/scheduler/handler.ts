import type { Db } from "../_shared/db.ts";
import { isEnabled } from "../_shared/features.ts";
import { pickDue, shouldReplenish, nextSlot } from "../_shared/queue.ts";
import { buildPostPrompt } from "../_shared/prompts.ts";
import { vacationPolicy } from "../_shared/vacation.ts";

export interface SchedulerDeps {
  db: Db;
  generate: (prompt: string) => Promise<{ text: string; model: string }>;
  sendMessage: (chatId: number, text: string) => Promise<unknown>;
  nowIso: string;
  fillTo?: number;
  postHour?: number;
  quietHours?: number[];
  getMemberCount?: (chatId: number) => Promise<number | null>;
}

export async function handleTick(deps: SchedulerDeps): Promise<{ published: number; replenished: number }> {
  const fillTo = deps.fillTo ?? 5;
  const postHour = deps.postHour ?? 10;
  const quietHours = deps.quietHours ?? [];
  const channels = (((await deps.db.from("channels").select()) as { data: Array<Record<string, any>> })?.data ?? []) as Array<
    Record<string, any>
  >;
  const queued = ((await deps.db.from("posts").eq("status", "queued").select()) as { data: Array<Record<string, any>> })
    ?.data ?? ([] as Array<Record<string, any>>);

  let published = 0;
  for (const post of pickDue(queued as unknown as Parameters<typeof pickDue>[0], deps.nowIso)) {
    const ch = channels.find((c) => c.id === post.channel_id);
    if (!ch?.telegram_channel_id) continue;
    if (!isEnabled(ch.features, "autoposting", true)) continue;
    await deps.sendMessage(Number(ch.telegram_channel_id), post.content);
    let subscribers: number | undefined;
    if (deps.getMemberCount) {
      subscribers = (await deps.getMemberCount(Number(ch.telegram_channel_id))) ?? undefined;
    }
    await deps.db.from("posts").eq("id", post.id).update({
      status: "published",
      published_at: deps.nowIso,
      ...(subscribers !== undefined ? { subscribers } : {}),
    });
    published += 1;
  }

  let replenished = 0;
  for (const ch of channels) {
    if (!isEnabled(ch.features, "autoposting", true)) continue;
    const vac = ch.vacation_from && ch.vacation_to ? { from: ch.vacation_from, to: ch.vacation_to } : null;
    if (vacationPolicy(vac, deps.nowIso.slice(0, 10)) === "pause") continue;
    const own = queued.filter((p) => p.channel_id === ch.id && p.status === "queued").length;
    if (!shouldReplenish(own, fillTo)) continue;
    const needed = fillTo - own;
    for (let i = 0; i < needed; i++) {
      const ph = ch.post_hour ?? postHour;
      const prompt = buildPostPrompt({
        topic: `Тема из очереди канала «${ch.title ?? ""}» (пополнение)`,
        rubric: "польза",
        channelTitle: ch.title,
      });
      const { text } = await deps.generate(prompt);
      await deps.db.from("posts").insert({
        user_id: ch.user_id,
        channel_id: ch.id,
        content: text,
        rubric: "польза",
        status: "queued",
        scheduled_at: nextSlot(deps.nowIso, quietHours, ph),
        priority: 10,
      });
      await deps.db.from("agent_log").insert({
        user_id: ch.user_id,
        agent: "scheduler",
        status: "ok",
        created_at: deps.nowIso,
      });
      replenished += 1;
    }
  }

  return { published, replenished };
}