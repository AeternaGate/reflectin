import { useEffect, useState } from "react";
import { api } from "../api";
import type { Channel } from "../types";
import { Card, Button, Field, Toggle, Error } from "../ui";

const FEATURES: { key: string; label: string }[] = [
  { key: "autoposting", label: "Автопостинг" },
  { key: "moderation", label: "Модерация" },
  { key: "autoreply", label: "Автоответы" },
  { key: "agents", label: "Агенты (/fact)" },
  { key: "trends", label: "Тренды (RSS)" },
  { key: "templates", label: "Шаблоны" },
];

export default function Channels() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [err, setErr] = useState("");
  const [title, setTitle] = useState("");
  const [username, setUsername] = useState("");

  async function load() {
    try { setChannels((await api.channels()).channels); } catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!title.trim()) return;
    try {
      await api.createChannel(title.trim(), username.trim());
      setTitle(""); setUsername("");
      await load();
    } catch (e: any) { setErr(e.message); }
  }

  return (
    <div className="space-y-3">
      <Card>
        <Field label="Название канала" value={title} onChange={setTitle} placeholder="Мой канал" />
        <Field label="Username (без @)" value={username} onChange={setUsername} placeholder="mychannel" />
        <div className="pt-2"><Button accent onClick={create} disabled={!title.trim()}>Добавить канал</Button></div>
        <Error msg={err} />
      </Card>
      {channels.length === 0 && <p className="px-1 text-xs text-muted">Каналов пока нет</p>}
      {channels.map((c) => <ChannelCard key={c.id} channel={c} onChange={load} />)}
    </div>
  );
}

function ChannelCard({ channel, onChange }: { channel: Channel; onChange: () => void }) {
  const [err, setErr] = useState("");
  const f = channel.features ?? {};
  async function toggle(key: string, v: boolean) {
    try { await api.patchChannel(channel.id, { features: { ...f, [key]: v } }); onChange(); }
    catch (e: any) { setErr(e.message); }
  }
  async function setField(patch: Partial<Channel>) {
    try { await api.patchChannel(channel.id, patch); onChange(); }
    catch (e: any) { setErr(e.message); }
  }

  return (
    <Card>
      <p className="font-medium">{channel.title}</p>
      <p className="text-xs text-muted">@{channel.username}</p>
      <div className="mt-2 border-t border-white/5 pt-1">
        {FEATURES.map((ft) => (
          <Toggle key={ft.key} label={ft.label} on={!!f[ft.key]} onChange={(v) => toggle(ft.key, v)} />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/5 pt-2">
        <Field label="Стиль" value={channel.style ?? ""} onChange={(v) => setField({ style: v })} placeholder="дружелюбный" />
        <Field label="Постов/день" type="number" value={String(channel.max_posts_per_day ?? 5)} onChange={(v) => setField({ max_posts_per_day: Number(v) || 0 })} />
        <Field label="Час публикации" type="number" value={String(channel.post_hour ?? 9)} onChange={(v) => setField({ post_hour: Number(v) || 0 })} />
        <Field label="Отпуск с (YYYY-MM-DD)" value={channel.vacation_from ?? ""} onChange={(v) => setField({ vacation_from: v || null })} />
        <Field label="Отпуск по (YYYY-MM-DD)" value={channel.vacation_to ?? ""} onChange={(v) => setField({ vacation_to: v || null })} />
      </div>
      <Error msg={err} />
    </Card>
  );
}
