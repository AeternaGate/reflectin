import { useEffect, useState } from "react";
import { api } from "../api";
import type { Draft } from "../types";
import { Card, Button, Field, Error } from "../ui";

const RUBRICS = ["Новости", "Лайфстайл", "Технологии", "Бизнес", "Развлечения", "Образование"];

export default function Generator() {
  const [rubric, setRubric] = useState(RUBRICS[0]);
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run() {
    if (!topic.trim()) return;
    setBusy(true); setErr(""); setResult("");
    try {
      const r = await api.gen(rubric, topic.trim());
      setResult(r.post.text);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <span className="text-xs text-muted">Рубрика</span>
        <select
          value={rubric}
          onChange={(e) => setRubric(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/5 bg-panel2 px-3 py-2 text-sm"
        >
          {RUBRICS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <Field label="Тема" value={topic} onChange={setTopic} placeholder="например, будущее ИИ" />
        <div className="pt-2">
          <Button accent onClick={run} disabled={busy || !topic.trim()}>
            {busy ? "Генерирую..." : "Сгенерировать"}
          </Button>
        </div>
        <Error msg={err} />
      </Card>
      {result && (
        <Card>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{result}</p>
        </Card>
      )}
      <Drafts />
    </div>
  );
}

function Drafts() {
  const [items, setItems] = useState<Draft[]>([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    api.drafts().then((r) => setItems(r.drafts)).catch((e: any) => setErr(e.message));
  }, [open]);

  return (
    <Card>
      <button
        className="flex w-full items-center justify-between text-sm font-medium"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Черновики</span>
        <span className="text-muted">{open ? "скрыть" : "показать"}</span>
      </button>
      <Error msg={err} />
      {open && (
        <div className="mt-2 space-y-2">
          {items.length === 0 && <p className="text-xs text-muted">Пока пусто</p>}
          {items.map((d) => (
            <div key={d.id} className="rounded-lg border border-white/5 bg-panel2 p-3">
              <p className="text-xs text-muted">{d.rubric} · {d.topic}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{d.text}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
