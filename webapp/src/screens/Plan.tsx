import { useState } from "react";
import { api } from "../api";
import type { PlanItem } from "../types";
import { Card, Button, Error } from "../ui";

const DAYS = [7, 14, 30];

export default function Plan() {
  const [days, setDays] = useState(7);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load(d: number) {
    setBusy(true); setErr(""); setItems([]);
    try {
      setItems((await api.plan(d)).plan);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex gap-2">
          {DAYS.map((d) => (
            <button
              key={d}
              onClick={() => { setDays(d); load(d); }}
              className={`flex-1 rounded-lg py-2 text-sm transition ${days === d ? "bg-accent text-black" : "bg-panel2 text-ink"}`}
            >
              {d} дн
            </button>
          ))}
        </div>
        <Error msg={err} />
        {busy && <p className="pt-2 text-xs text-muted">Составляю план...</p>}
      </Card>
      {items.map((p) => (
        <Card key={p.day}>
          <p className="text-xs text-muted">{p.date} · день {p.day}</p>
          <p className="mt-1 text-sm">{p.rubric} — {p.topic}</p>
        </Card>
      ))}
    </div>
  );
}
