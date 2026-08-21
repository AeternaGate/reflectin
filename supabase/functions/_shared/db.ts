/** Структурный тип: функции принимают любой объект с .from (реальный клиент или мок). */
export interface DbTable {
  select: (cols?: string) => DbTable;
  eq: (k: string, v: unknown) => DbTable;
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
  single: () => Promise<{ data: unknown; error: { message: string } | null }>;
  data: unknown;
  error: { message: string } | null;
  insert: (row: Record<string, unknown>) => DbTable;
}
export interface Db { from: (table: string) => DbTable }

export function dbFromEnv(createClient: (url: string, key: string) => unknown = defaultCreateClient): Db {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY не заданы");
  return createClient(url, key) as Db;
}

function defaultCreateClient(url: string, key: string): unknown {
  const { createClient } = loadSupabaseJs();
  return createClient(url, key);
}

// ленивый импорт: модуль не тянет supabase-js в тестах, рост только при вызове в функциях
let _supabase: typeof import("npm:@supabase/supabase-js@2");
function loadSupabaseJs() {
  if (!_supabase) _supabase = import("npm:@supabase/supabase-js@2");
  return _supabase;
}

export interface PostRow { id: string; content: string; rubric: string; created_at: string; status: string }

export async function quotaUsedToday(db: Db, userId: string, date: string): Promise<number> {
  const { data, error } = await db
    .from("generation_log")
    .select("created_at")
    .eq("user_id", userId);
  if (error) throw new Error(`quotaUsedToday: ${error.message}`);
  const start = `${date}T00:00:00Z`;
  const end = `${date}T23:59:59.999Z`;
  const rows = (data ?? []) as Array<{ created_at: string }>;
  return rows.filter((r) => r.created_at >= start && r.created_at < end).length;
}

export async function getOrCreateUser(db: Db, telegramId: number, firstName: string): Promise<{ id: string; plan?: string }> {
  const { data: existing, error: err1 } = await db
    .from("users").select("id, plan").eq("telegram_id", telegramId).maybeSingle();
  if (err1) throw new Error(`getOrCreateUser: ${err1.message}`);
  if (existing) return { id: (existing as { id: string }).id, plan: (existing as { plan?: string }).plan ?? "free" };
  const { data: created, error: err2 } = await db
    .from("users")
    .insert({ telegram_id: telegramId, first_name: firstName })
    .select().single();
  if (err2 || !created) throw new Error(`getOrCreateUser insert: ${err2?.message}`);
  return { id: (created as { id: string }).id, plan: (created as { plan?: string }).plan ?? "free" };
}

export async function insertPost(
  db: Db,
  p: { user_id: string; content: string; rubric?: string; status: "draft" | "published" },
): Promise<string> {
  const { data, error } = await db
    .from("posts")
    .insert({ user_id: p.user_id, content: p.content, rubric: p.rubric ?? "польза", status: p.status })
    .select().single();
  if (error || !data) throw new Error(`insertPost: ${error?.message}`);
  return (data as { id: string }).id;
}

export async function logGeneration(
  db: Db,
  p: { user_id: string; feature: string; model: string },
): Promise<void> {
  const { error } = await db.from("generation_log").insert(p);
  if (error) throw new Error(`logGeneration: ${error.message}`);
}

export async function getDrafts(
  db: Db,
  userId: string,
): Promise<Array<{ id: string; content: string; rubric: string; created_at: string }>> {
  const { data, error } = await db.from("posts").select("id, content, rubric, created_at").eq("user_id", userId).eq("status", "draft");
  if (error) throw new Error(`getDrafts: ${error.message}`);
  return (data ?? []) as Array<{ id: string; content: string; rubric: string; created_at: string }>;
}
