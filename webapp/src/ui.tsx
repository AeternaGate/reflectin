import type { ReactNode } from "react";

export function Card({ children }: { children: ReactNode }) {
  return <div className="border border-white/5 bg-panel/80 rounded-2xl p-4">{children}</div>;
}

export function Button({
  children, onClick, disabled, accent,
}: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-xl px-4 py-3 font-medium transition disabled:opacity-40 ${
        accent ? "bg-accent text-black" : "bg-panel2 text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function Toggle({
  on, onChange, label,
}: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!on)}
        className={`h-6 w-11 rounded-full transition ${on ? "bg-accent" : "bg-panel2"}`}
      >
        <span
          className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition ${
            on ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

export function Field({
  label, value, onChange, placeholder, type,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <label className="block py-2">
      <span className="text-xs text-muted">{label}</span>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-white/5 bg-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}

export function Error({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="pt-2 text-xs text-red-400">{msg}</p>;
}
