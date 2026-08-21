export interface FeedItem { title: string; link: string }

const ITEM_RE = /<item>[\s\S]*?<\/item>/g;
const TITLE_RE = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/;
const LINK_RE = /<link>([\s\S]*?)<\/link>/;

export function parseRss(xml: string): FeedItem[] {
  const out: FeedItem[] = [];
  for (const m of xml.match(ITEM_RE) ?? []) {
    const t = m.match(TITLE_RE)?.[1];
    const l = m.match(LINK_RE)?.[1];
    if (t && l) out.push({ title: t.trim(), link: l.trim() });
  }
  return out;
}

export function extractTrends(items: FeedItem[]): string[] {
  const freq: Record<string, number> = {};
  for (const it of items) {
    for (const word of it.title.split(/\s+/)) {
      const w = word.replace(/[^A-Za-zА-Яа-яЁё0-9]/g, "").toLowerCase();
      if (w.length >= 2) freq[w] = (freq[w] ?? 0) + 1;
    }
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([w]) => w);
}
