import { corsHeaders, okJson, errJson } from "../_shared/cors.ts";
import { validateInitData, initDataUser } from "../_shared/initdata.ts";
import { getOrCreateUser, quotaUsedToday, insertPost, logGeneration, getDrafts, type Db } from "../_shared/db.ts";
import { buildPostPrompt, RUBRICS, type Rubric } from "../_shared/prompts.ts";
import { planLimits, dailyQuota, validatePlan } from "../_shared/plans.ts";
import { atLeast } from "../_shared/roles.ts";
import { parseRss, extractTrends } from "../_shared/rss.ts";
import { isEnabled } from "../_shared/features.ts";

export interface ApiDeps {
  botToken: string;
  db: Db;
  apiKey: string;
  models: string[];
  freeQuota: number;
  generate: (prompt: string) => Promise<{ text: string; model: string }>;
  fetchImpl?: typeof fetch;
  nowSeconds?: number;
}

async function resolveChannelId(
  deps: ApiDeps,
  userId: string,
  queryChannelId: string | null,
): Promise<string | null> {
  if (queryChannelId) return queryChannelId;
  const members = (await deps.db.from("channel_members").select("channel_id").eq("user_id", userId)).data ?? [];
  if (members.length) return (members[0] as { channel_id: string }).channel_id;
  return null;
}

async function authUser(req: Request, deps: ApiDeps): Promise<{ id: number; first_name: string } | null> {
  const raw = req.headers.get("x-init-data");
  if (!raw) return null;
  const ok = await validateInitData(raw, deps.botToken, 86400, deps.nowSeconds);
  if (!ok) return null;
  return initDataUser(raw);
}

export async function handleApiRequest(req: Request, deps: ApiDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const last = path.slice(path.lastIndexOf("/") + 1);

  const user = await authUser(req, deps);
  if (!user) return errJson(401, "Невалидный initData");
  if (last === "quota" && req.method === "GET") {
    const dbUser = await getOrCreateUser(deps.db, user.id, user.first_name);
    const used = await quotaUsedToday(deps.db, dbUser.id, new Date().toISOString().slice(0, 10));
    return okJson({ used, free: deps.freeQuota, rubrics: RUBRICS, plan: dbUser.plan ?? "free" });
  }
  if (last === "drafts" && req.method === "GET") {
    const dbUser = await getOrCreateUser(deps.db, user.id, user.first_name);
    return okJson({ drafts: await getDrafts(deps.db, dbUser.id) });
  }
  if (last === "gen" && req.method === "POST") {
    const body = await req.json().catch(() => null);
    const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
    const rubric = body?.rubric as Rubric;
    if (!topic) return errJson(400, "Тема обязательна");
    if (!RUBRICS.includes(rubric)) return errJson(400, "Неверная рубрика");

    const dbUser = await getOrCreateUser(deps.db, user.id, user.first_name);
    const date = new Date().toISOString().slice(0, 10);
    const limit = dailyQuota(dbUser.plan ?? "free", deps.freeQuota);
    const used = await quotaUsedToday(deps.db, dbUser.id, date);
    if (used >= limit) return errJson(429, "Лимит на сегодня исчерпан");

    const prompt = buildPostPrompt({ topic, rubric });
    const { text, model } = await deps.generate(prompt);
    await insertPost(deps.db, { user_id: dbUser.id, content: text, rubric, status: "draft" });
    await logGeneration(deps.db, { user_id: dbUser.id, feature: "post", model });
    return okJson({ post: text, draft: true });
  }
  if (last === "me" && req.method === "GET") {
    const dbUser = await getOrCreateUser(deps.db, user.id, user.first_name);
    const plan = dbUser.plan ?? "free";
    const limits = planLimits(plan);
    return okJson({ id: dbUser.id, plan, limits });
  }
  if (last === "channels" && req.method === "GET") {
    const dbUser = await getOrCreateUser(deps.db, user.id, user.first_name);
    const members = (await deps.db.from("channel_members").select("channel_id").eq("user_id", dbUser.id)).data ?? [];
    const ids = (members as Array<{ channel_id: string }>).map((m) => m.channel_id);
    const all = (await deps.db.from("channels").select("*")).data ?? [];
    const channels = (all as Array<Record<string, unknown>>).filter((c) => ids.includes(c.id as string));
    return okJson({ channels });
  }
  if (last === "channels" && req.method === "POST") {
    const dbUser = await getOrCreateUser(deps.db, user.id, user.first_name);
    const limits = planLimits(dbUser.plan ?? "free");
    const owned = (await deps.db.from("channels").select("id").eq("user_id", dbUser.id)).data ?? [];
    if (owned.length >= limits.channels) return errJson(403, "Превышен лимит каналов тарифа");
    const body = await req.json().catch(() => null);
    if (!body?.telegram_channel_id || !body?.title) return errJson(400, "Нужны telegram_channel_id и title");
    const created = await deps.db
      .from("channels")
      .insert({ user_id: dbUser.id, telegram_channel_id: body.telegram_channel_id, title: body.title, features: {} })
      .select().single();
    const channel = created.data as { id: string };
    await deps.db.from("channel_members").insert({ channel_id: channel.id, user_id: dbUser.id, role: "owner" });
    return okJson({ channel });
  }
  const channelPatch = path.match(/\/channels\/(.+)$/);
  if (channelPatch && req.method === "PATCH") {
    const dbUser = await getOrCreateUser(deps.db, user.id, user.first_name);
    const channelId = channelPatch[1];
    const member = (await deps.db.from("channel_members").select("role").eq("channel_id", channelId).eq("user_id", dbUser.id)).maybeSingle().data as { role: string } | null;
    let role = member?.role ?? "";
    if (!role) {
      const ch = (await deps.db.from("channels").select("user_id").eq("id", channelId)).maybeSingle().data as { user_id: string } | null;
      if (ch?.user_id === dbUser.id) role = "owner";
    }
    if (!atLeast(role, "editor")) return errJson(403, "Нужна роль editor или выше");
    const body = await req.json().catch(() => null);
    if (!body) return errJson(400, "Пустое тело");
    const patch: Record<string, unknown> = {};
    for (const k of ["features", "vacation_from", "vacation_to", "post_hour", "style", "max_posts_per_day"]) {
      if (k in body) patch[k] = body[k];
    }
    await deps.db.from("channels").update(patch).eq("id", channelId);
    return okJson({ ok: true });
  }
  if (last === "plan" && req.method === "GET") {
    const dbUser = await getOrCreateUser(deps.db, user.id, user.first_name);
    const plan = dbUser.plan ?? "free";
    const days = Number(url.searchParams.get("days") ?? "7");
    if (![7, 14, 30].includes(days)) return errJson(400, "days должно быть 7, 14 или 30");
    if (days === 30 && plan !== "pro") return errJson(403, "30 дней доступно только на тарифе pro");
    const { text, model } = await deps.generate(`plan ${days}`);
    let items: unknown;
    try { items = JSON.parse(text); } catch { return errJson(502, "Некорректный ответ генерации плана"); }
    const v = validatePlan(items as Array<{ day: number; rubric: string; topic: string }>, days);
    if (!v.ok) return errJson(422, v.error);
    await logGeneration(deps.db, { user_id: dbUser.id, feature: "plan", model });
    return okJson({ plan: items });
  }
  if (last === "faq" && (req.method === "GET" || req.method === "POST")) {
    const dbUser = await getOrCreateUser(deps.db, user.id, user.first_name);
    const channelId = await resolveChannelId(deps, dbUser.id, url.searchParams.get("channel_id"));
    if (!channelId) return errJson(404, "Не найден канал");
    if (req.method === "GET") {
      const row = (await deps.db.from("knowledge_base").select("content").eq("channel_id", channelId)).maybeSingle().data as { content: string } | null;
      return okJson({ content: row?.content ?? "" });
    }
    const body = await req.json().catch(() => null);
    if (!body || typeof body.content !== "string") return errJson(400, "Нужен content");
    const existing = (await deps.db.from("knowledge_base").select("id").eq("channel_id", channelId)).maybeSingle().data as { id: string } | null;
    if (existing) {
      await deps.db.from("knowledge_base").update({ content: body.content }).eq("channel_id", channelId);
    } else {
      await deps.db.from("knowledge_base").insert({ channel_id: channelId, content: body.content });
    }
    return okJson({ ok: true });
  }
  if (last === "templates" && req.method === "GET") {
    const dbUser = await getOrCreateUser(deps.db, user.id, user.first_name);
    const rows = (await deps.db.from("templates").select("*").eq("user_id", dbUser.id)).data ?? [];
    return okJson({ templates: rows });
  }
  if (last === "templates" && req.method === "POST") {
    const dbUser = await getOrCreateUser(deps.db, user.id, user.first_name);
    const body = await req.json().catch(() => null);
    if (!body?.title || !body?.content) return errJson(400, "Нужны title и content");
    const created = await deps.db
      .from("templates")
      .insert({ user_id: dbUser.id, title: body.title, content: body.content })
      .select().single();
    return okJson({ template: created.data });
  }
  if (last === "trends" && req.method === "GET") {
    const dbUser = await getOrCreateUser(deps.db, user.id, user.first_name);
    const channelId = await resolveChannelId(deps, dbUser.id, url.searchParams.get("channel_id"));
    if (!channelId) return errJson(404, "Не найден канал");
    const ch = (await deps.db.from("channels").select("features").eq("id", channelId)).maybeSingle().data as { features: Record<string, boolean> } | null;
    if (ch && !isEnabled(ch.features, "trends", true)) return errJson(403, "Мониторинг трендов отключён");
    const fetchImpl = deps.fetchImpl ?? fetch;
    const monitors = (await deps.db.from("monitoring_channels").select("source").eq("channel_id", channelId)).data ?? [];
    const all: string[] = [];
    for (const m of monitors as Array<{ source: string }>) {
      try {
        const resp = await fetchImpl(m.source);
        const xml = await resp.text();
        all.push(...extractTrends(parseRss(xml)));
      } catch {
        // ошибки источников глотаем
      }
    }
    const top = [...new Set(all)].slice(0, 10);
    return okJson({ trends: top });
  }
  return errJson(404, "Не найдено");
}
