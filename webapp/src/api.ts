import type { Me, Draft, Channel, PlanItem, Template, Trend } from "./types";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
const initData = (): string =>
  (typeof window !== "undefined" && (window as any).Telegram?.WebApp?.initData) || "";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-init-data": initData(),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export const api = {
  me: () => req<Me>("/me"),
  quota: () => req<{ used: number; limit: number }>("/quota"),
  gen: (rubric: string, topic: string) =>
    req<{ post: Draft }>("/gen", { method: "POST", body: JSON.stringify({ rubric, topic }) }),
  drafts: () => req<{ drafts: Draft[] }>("/drafts"),
  channels: () => req<{ channels: Channel[] }>("/channels"),
  createChannel: (title: string, username: string) =>
    req<{ channel: Channel }>("/channels", { method: "POST", body: JSON.stringify({ title, username }) }),
  patchChannel: (id: string, patch: Partial<Channel>) =>
    req<{ channel: Channel }>(`/channels/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  plan: (days: number) => req<{ plan: PlanItem[] }>(`/plan?days=${days}`),
  faqGet: (channelId: string) => req<{ content: string }>(`/faq?channel_id=${channelId}`),
  faqSet: (channelId: string, content: string) =>
    req<{ ok: true }>("/faq", { method: "POST", body: JSON.stringify({ channel_id: channelId, content }) }),
  templates: () => req<{ templates: Template[] }>("/templates"),
  createTemplate: (name: string, content: string) =>
    req<{ template: Template }>("/templates", { method: "POST", body: JSON.stringify({ name, content }) }),
  trends: (channelId: string) => req<{ trends: Trend[] }>(`/trends?channel_id=${channelId}`),
};
