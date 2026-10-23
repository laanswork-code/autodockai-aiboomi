// Flattens data/raw/*.json into data/items.json: one deduped record per URL.
import { readdir, readFile, writeFile } from "node:fs/promises";

const RAW = new URL("../data/raw/", import.meta.url);
const OUT = new URL("../data/items.json", import.meta.url);

const clean = (url) => url.replace(/[?#].*$/, "").replace(/\/$/, "").replace("://old.reddit.com", "://www.reddit.com");
const subreddit = (url) => url.match(/reddit\.com\/r\/([^/]+)/i)?.[1] ?? null;

function rows({ query, response }) {
  if (query.engine === "google_news") {
    // Some news results are clusters with nested stories.
    return (response.news_results ?? []).flatMap((r) => (r.stories ?? [r])).map((r) => ({
      title: r.title, url: r.link, snippet: r.snippet ?? "", source: r.source?.name ?? "", date: r.date ?? "",
    }));
  }
  return (response.organic_results ?? []).map((r) => ({
    title: r.title, url: r.link, snippet: r.snippet ?? "", source: r.source ?? r.displayed_link ?? "", date: r.date ?? "",
    // For Reddit, Google shows e.g. "20+ comments · 1 year ago" here.
    engagement: /comment|ago|answer/i.test(r.displayed_link ?? "") ? r.displayed_link : "",
  }));
}

const byUrl = new Map();
for (const f of (await readdir(RAW)).filter((f) => f.endsWith(".json"))) {
  const data = JSON.parse(await readFile(new URL(f, RAW), "utf8"));
  for (const r of rows(data)) {
    if (!r.url) continue;
    const url = clean(r.url);
    const isReddit = url.includes("reddit.com");
    // Reddit queries sometimes return profile or search pages; keep posts only.
    if (isReddit && !/\/comments\//.test(url)) continue;
    const kind = isReddit ? "reddit" : data.query.kind === "news" ? "news" : "web";
    const prev = byUrl.get(url);
    if (prev) { prev.queries.push(data.query.q); continue; }
    byUrl.set(url, {
      url, kind, region: data.query.region, title: r.title, snippet: r.snippet,
      source: isReddit ? `r/${subreddit(url)}` : r.source, date: r.date, engagement: r.engagement ?? "", queries: [data.query.q],
    });
  }
}

const items = [...byUrl.values()];
await writeFile(OUT, JSON.stringify(items, null, 2));
const count = (k) => items.filter((i) => i.kind === k).length;
console.log(`${items.length} items: reddit ${count("reddit")}, news ${count("news")}, web ${count("web")}`);
