export type AnyRow = Record<string, any>;

let __id = 0;
function fakerId() {
  __id += 1;
  return `id${__id}`;
}

/** Детерминированный in-memory мок Supabase-клиента: select/eq/maybeSingle/single/insert. */
export function makeFakeDb(seed: Record<string, AnyRow[]>) {
  const rows: Record<string, AnyRow[]> = { ...seed };
  const calls: string[] = [];

  const chain = (t: string, filters: Array<[string, any]>) => {
    const apply = (arr: AnyRow[]) => arr.filter((r) => filters.every(([k, v]) => r[k] === v));
    const base = {
      select: () => chain(t, filters),
      eq: (k: string, v: any) => chain(t, [...filters, [k, v]]),
      maybeSingle: () => ({ data: apply(rows[t] ?? [])[0] ?? null, error: null }),
      single: () => {
        const found = apply(rows[t] ?? [])[0];
        return found
          ? { data: found, error: null }
          : { data: null, error: { message: "PGRST116" } };
      },
      data: apply(rows[t] ?? []),
      error: null,
    };
    return {
      ...base,
      update: (patch: Record<string, unknown>) => {
        calls.push(`update:${t}:${Object.keys(patch).sort().join(",")}`);
        apply(rows[t] ?? []).forEach((r) => Object.assign(r, patch));
        return chain(t, filters);
      },
      insert: (obj: Record<string, unknown>) => {
        calls.push(`insert:${t}:${Object.keys(obj).sort().join(",")}`);
        const row = { id: fakerId(), ...obj };
        rows[t] = [...(rows[t] ?? []), row];
        return { select: () => ({ single: () => ({ data: row, error: null }) }) };
      },
    };
  };

  return {
    rows,
    calls,
    from: (t: string) => {
      calls.push(`from:${t}`);
      return chain(t, []);
    },
  };
}

export type FakeDb = ReturnType<typeof makeFakeDb>;