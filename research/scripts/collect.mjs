// Runs every query in queries.mjs through SerpAPI and caches raw JSON in data/raw/.
// Cached queries are skipped, so reruns are free. Delete a file to refetch it.
import { getJson } from "serpapi";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { QUERIES } from "./queries.mjs";

const RAW = new URL("../data/raw/", import.meta.url);
const apiKey = process.env.SERPAPI_KEY;
if (!apiKey) throw new Error("SERPAPI_KEY missing. Copy .env.example to .env and run with npm run collect.");

const slug = (q) => `${q.engine}__${q.q}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 120);
const exists = (u) => access(u).then(() => true, () => false);

await mkdir(RAW, { recursive: true });
let fetched = 0;
for (const q of QUERIES) {
  const file = new URL(`${slug(q)}.json`, RAW);
  if (await exists(file)) continue;
  const params = { engine: q.engine, q: q.q, api_key: apiKey, gl: "in", hl: "en" };
  if (q.engine === "google") params.num = 20;
  try {
    const res = await getJson(params);
    delete res.search_parameters?.api_key;
    await writeFile(file, JSON.stringify({ query: q, response: res }, null, 2));
    fetched++;
    console.log(`ok   ${q.q}`);
  } catch (err) {
    console.error(`fail ${q.q}: ${err.message}`);
  }
}
console.log(`fetched ${fetched}, cached ${QUERIES.length - fetched}`);
