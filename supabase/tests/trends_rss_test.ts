import { assertEquals, assert } from "jsr:@std/assert";
import { parseRss, extractTrends, type FeedItem } from "../functions/_shared/rss.ts";

const RSS = `<?xml version="1.0"?>
<rss version="2.0">
<channel>
  <title>Новости маркетинга</title>
  <item>
    <title>ИИ меняет SMM</title>
    <link>https://ex.com/1</link>
  </item>
  <item>
    <title>ИИ и тренды контента</title>
    <link>https://ex.com/2</link>
  </item>
  <item>
    <title>Старый пост про SEO</title>
    <link>https://ex.com/3</link>
  </item>
</channel>
</rss>`;

Deno.test("parseRss: извлекает item'ы с заголовком и ссылкой", () => {
  const items = parseRss(RSS);
  assert(items.length >= 3);
  assertEquals(items[0].title, "ИИ меняет SMM");
  assertEquals(items[0].link, "https://ex.com/1");
});

Deno.test("parseRss: без item'ов — пустой массив", () => {
  assertEquals(parseRss("<rss><channel></channel></rss>"), []);
});

Deno.test("extractTrends: подсчитывает повторяющиеся слова в темах", () => {
  const items: FeedItem[] = parseRss(RSS);
  const trends = extractTrends(items);
  assert(trends.includes("ии"), `ожидали ИИ в трендах: ${JSON.stringify(trends)}`);
  assertEquals(trends[0], "ии");
});

Deno.test("extractTrends: пустой ввод — пустой результат", () => {
  assertEquals(extractTrends([]), []);
});