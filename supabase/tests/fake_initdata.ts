import {
  parseInitData,
  buildDataCheckString,
  deriveSecretKey,
  computeHash,
} from "../functions/_shared/initdata.ts";

/** Ставит корректный hash на произвольный набор полей — для тест-векторов. */
export async function signInitData(fields: Record<string, string>, botToken: string): Promise<string> {
  const secret = await deriveSecretKey(botToken);
  const hash = await computeHash(buildDataCheckString(fields), secret);
  const qs = Object.entries(fields)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  return `${qs}&hash=${hash}`;
}

export function userFields(id: number, firstName = "Test"): Record<string, string> {
  return {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id, first_name: firstName }),
  };
}