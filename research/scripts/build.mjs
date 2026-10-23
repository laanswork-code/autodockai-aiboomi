// Merges classified chunks into data/posts.json and renders site/index.html
// from site/template.html with the data inlined, so the page opens from disk.
import { readdir, readFile, writeFile } from "node:fs/promises";

const DATA = new URL("../data/", import.meta.url);
const CHUNKS = new URL("chunks/", DATA);
const SITE = new URL("../site/", import.meta.url);

// House style bans long dashes, so scraped headlines get commas instead.
// An en dash between two alphanumerics (a range like 10\u201320) is kept.
const DASH = /\s*[\u2012\u2014\u2015\u2212\u2E3A\u2E3B\uFE58\uFE63\uFF0D]\s*|\s+\u2013\s*|\s*\u2013\s+|\s+--\s+/g;
const tidy = (s) => (s ?? "").replace(DASH, ", ");
const read = async (u) => JSON.parse(await readFile(u, "utf8"));
const CITY_ORDER = ["Kozhikode", "Kochi", "Thiruvananthapuram", "Thrissur", "Kerala (other)",
  "Bengaluru", "Mumbai", "Delhi NCR", "Chennai", "Hyderabad", "Pune", "India (other)"];
const KIND_ORDER = ["reddit", "web", "news"];

const items = new Map((await read(new URL("items.json", DATA))).map((i) => [i.url, i]));
const files = (await readdir(CHUNKS)).filter((f) => f.startsWith("in-")).sort();
const posts = [];
for (const f of files) {
  const input = await read(new URL(f, CHUNKS));
  const out = await read(new URL(f.replace("in-", "out-"), CHUNKS));
  const byId = new Map(out.map((o) => [o.id, o]));
  for (const item of input) {
    const c = byId.get(item.id);
    if (!c?.keep || !CITY_ORDER.includes(c.city)) continue;
    posts.push({
      url: item.url, kind: item.kind, source: item.source, date: item.date,
      engagement: items.get(item.url)?.engagement ?? "",
      title: tidy(item.title.replace(/ : r\/\w+$/, "")), snippet: tidy(item.snippet),
      city: c.city, category: c.category, problem: tidy(c.problem), quote: tidy(c.quote),
    });
  }
}
posts.sort((a, b) => CITY_ORDER.indexOf(a.city) - CITY_ORDER.indexOf(b.city)
  || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));

const meta = { collected: new Date().toISOString().slice(0, 10), cities: CITY_ORDER };
await writeFile(new URL("posts.json", DATA), JSON.stringify(posts, null, 2));
const template = await readFile(new URL("template.html", SITE), "utf8");
const payload = JSON.stringify({ meta, posts }).replace(/</g, "\\u003c");
await writeFile(new URL("index.html", SITE), template.replace("/*__DATA__*/null", payload));
console.log(`${posts.length} posts -> site/index.html`);
