import { safeJsonParse } from "./json.ts";

export function parseInitData(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of raw.split("&")) {
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    out[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1));
  }
  return out;
}

export function buildDataCheckString(fields: Record<string, string>): string {
  return Object.keys(fields)
    .filter((k) => k !== "hash")
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
}

export async function deriveSecretKey(botToken: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(botToken));
  return new Uint8Array(sig);
}

export async function computeHash(dataCheckString: string, secretKey: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    secretKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(dataCheckString));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function validateInitData(
  raw: string,
  botToken: string,
  maxAgeSeconds = 86400,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const fields = parseInitData(raw);
  const hash = fields["hash"];
  const authDate = Number(fields["auth_date"]);
  if (!hash || !Number.isFinite(authDate) || nowSeconds - authDate > maxAgeSeconds) return false;
  const secret = await deriveSecretKey(botToken);
  const expected = await computeHash(buildDataCheckString(fields), secret);
  return safeEqual(expected, hash);
}

export function initDataUser(raw: string): { id: number; first_name: string } | null {
  const u = safeJsonParse(parseInitData(raw)["user"] ?? "", null);
  if (!isUserPayload(u)) return null;
  return { id: Number(u.id), first_name: String(u.first_name ?? "") };
}

function isUserPayload(v: unknown): v is { id: number | string; first_name?: unknown } {
  return typeof v === "object" && v !== null && "id" in v;
}
