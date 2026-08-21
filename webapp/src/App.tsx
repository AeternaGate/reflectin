import { useState, type ReactElement } from "react";
import { Sparkle, Broadcast, CalendarDots, Crown, BookmarkSimple, Brain } from "@phosphor-icons/react";
import BeamsBackground from "./BeamsBackground";
import Generator from "./screens/Generator";
import Channels from "./screens/Channels";
import Plan from "./screens/Plan";
import Tariffs from "./screens/Tariffs";
import Templates from "./screens/Templates";
import Knowledge from "./screens/Knowledge";

type Tab = "gen" | "channels" | "plan" | "tariffs" | "templates" | "knowledge";

const NAV: { id: Tab; label: string; Icon: any }[] = [
  { id: "gen", label: "Генератор", Icon: Sparkle },
  { id: "channels", label: "Каналы", Icon: Broadcast },
  { id: "plan", label: "План", Icon: CalendarDots },
  { id: "tariffs", label: "Тарифы", Icon: Crown },
  { id: "templates", label: "Шаблоны", Icon: BookmarkSimple },
  { id: "knowledge", label: "База", Icon: Brain },
];

const SCREENS: Record<Tab, () => ReactElement> = {
  gen: Generator,
  channels: Channels,
  plan: Plan,
  tariffs: Tariffs,
  templates: Templates,
  knowledge: Knowledge,
};

export default function App() {
  const [tab, setTab] = useState<Tab>("gen");
  const Screen = SCREENS[tab];

  return (
    <div className="relative min-h-full">
      <BeamsBackground />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col">
        <header className="px-4 pt-6 pb-2">
          <h1 className="text-xl font-semibold tracking-tight">Reflectin</h1>
          <p className="text-xs text-muted">Контент-инженерия для Telegram-каналов</p>
        </header>
        <main className="flex-1 px-4 pb-24 pt-2">
          <Screen />
        </main>
        <nav className="fixed bottom-0 inset-x-0 z-20 mx-auto max-w-md border-t border-white/5 bg-bg/90 backdrop-blur">
          <div className="grid grid-cols-6">
            {NAV.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex flex-col items-center gap-1 py-2 text-[10px] transition ${
                  tab === id ? "text-accent" : "text-muted"
                }`}
              >
                <Icon size={20} weight={tab === id ? "fill" : "regular"} />
                {label}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
