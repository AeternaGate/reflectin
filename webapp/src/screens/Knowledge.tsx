import { useEffect, useState } from "react";
import { api } from "../api";
import type { Channel, Trend } from "../types";
import { Card, Button, Field, Error } from "../ui";

export default function Knowledge() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelId, setChannelId] = useState("");
  const [faq, setFaq] = useState("");
  const [trends, setTrends] = useState<Trend[]>([]);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    api.channels().then((r) => {
      setChannels(r.channels);
      if (r.channels[0]) setChannelId(r.channels[0].id);
    }).catch((e: any) => setErr(e.message));
  }, []);

  useEffect(() => {
    if (!channelId) return;
    setSaved("");
    api.faqGet(channelId).then((r) => setFaq(r.content ?? "")).catch(() => setFaq(""));
  }, [channelId]);

  async function saveFaq() {
    if (!channelId) return;
    try { await api.faqSet(channelId, faq); setSaved("База знаний сохранена"); setErr(""); }
    catch (e: any) { setErr(e.message); }
  }
  async function loadTrends() {
    if (!channelId) return;
    try { setTrends((await api.trends(channelId)).trends); setErr(""); }
    catch (e: any) { setErr(e.message); }
  }

  return (
    <div className="space-y-3">
      <Card>
        <label className="text-xs text-muted">Канал</label>
        <select
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/5 bg-panel2 px-3 py-2 text-sm"
        >
          {channels.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </Card>
      <Card>
        <span className="text-sm font-medium">База знаний (FAQ)</span>
        <label className="block py-2">
          <span className="text-xs text-muted">Текст базы — источник для автоответов</span>
          <textarea
            value={faq}
            onChange={(e) => setFaq(e.target.value)}
            rows={6}
            className="mt-1 w-full rounded-lg border border-white/5 bg-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>
        <Button accent onClick={saveFaq}>Сохранить</Button>
        {saved && <p className="pt-2 text-xs text-accent">{saved}</p>}
      </Card>
      <Card>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Тренды (RSS)</span>
          <button className="text-xs text-accent" onClick={loadTrends}>обновить</button>
        </div>
        <Error msg={err} />
        <div className="mt-2 space-y-2">
          {trends.length === 0 && <p className="text-xs text-muted">Нажмите «обновить»</p>}
          {trends.map((t, i) => (
            <a key={i} href={t.url} target="_blank" rel="noreferrer" className="block rounded-lg border border-white/5 bg-panel2 p-3 hover:border-accent">
              <p className="text-xs text-muted">{t.source}</p>
              <p className="mt-1 text-sm">{t.title}</p>
            </a>
          ))}
        </div>
      </Card>
    </div>
  );
}
