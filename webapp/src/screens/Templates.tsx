import { useEffect, useState } from "react";
import { api } from "../api";
import type { Template } from "../types";
import { Card, Button, Field, Error } from "../ui";

export default function Templates() {
  const [items, setItems] = useState<Template[]>([]);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    try { setItems((await api.templates()).templates); } catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!name.trim() || !content.trim()) return;
    try {
      await api.createTemplate(name.trim(), content.trim());
      setName(""); setContent("");
      await load();
    } catch (e: any) { setErr(e.message); }
  }

  return (
    <div className="space-y-3">
      <Card>
        <Field label="Название" value={name} onChange={setName} placeholder="Универсальный пост" />
        <label className="block py-2">
          <span className="text-xs text-muted">Содержание (поддерживает {`{rubric}`}, {`{topic}`})</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-white/5 bg-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>
        <div className="pt-2"><Button accent onClick={add} disabled={!name.trim() || !content.trim()}>Сохранить шаблон</Button></div>
        <Error msg={err} />
      </Card>
      {items.map((t) => (
        <Card key={t.id}>
          <p className="font-medium">{t.name}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{t.content}</p>
        </Card>
      ))}
    </div>
  );
}
