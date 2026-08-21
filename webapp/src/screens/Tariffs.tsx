import { useEffect, useState } from "react";
import { api } from "../api";
import type { Me } from "../types";
import { Card, Button, Error } from "../ui";

const TARIFFS = [
  { id: "free", name: "Free", price: "0", stars: 0, perks: ["2 канала", "2 генерации/день"] },
  { id: "starter", name: "Starter", price: "199", stars: 199, perks: ["3 канала", "10 генераций/день"] },
  { id: "pro", name: "Pro", price: "499", stars: 499, perks: ["5 каналов", "50 генераций/день", "Агенты", "Тренды", "План 30 дней"] },
  { id: "agency", name: "Agency", price: "999", stars: 999, perks: ["10 каналов", "Безлимитные агенты", "Командные роли"] },
];

const BOT = import.meta.env.VITE_BOT_USERNAME || "";

export default function Tariffs() {
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.me().then(setMe).catch((e: any) => setErr(e.message));
  }, []);

  return (
    <div className="space-y-3">
      <Card>
        <p className="text-sm">Ваш тариф: <span className="text-accent">{me?.plan ?? "..."}</span></p>
        <Error msg={err} />
      </Card>
      {TARIFFS.map((t) => (
        <Card key={t.id}>
          <div className="flex items-baseline justify-between">
            <p className="font-medium">{t.name}</p>
            <p className="text-sm text-muted">{t.stars ? `${t.stars} ★` : "бесплатно"}</p>
          </div>
          <ul className="mt-2 space-y-1">
            {t.perks.map((p) => <li key={p} className="text-xs text-muted">• {p}</li>)}
          </ul>
          {t.id !== "free" && (
            <div className="pt-3">
              <Button
                accent={me?.plan === t.id}
                onClick={() => { if (BOT) window.open(`https://t.me/${BOT}?start=tariffs`, "_blank"); }}
              >
                {me?.plan === t.id ? "Текущий" : (BOT ? "Оплатить" : "Откройте бота для оплаты")}
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
