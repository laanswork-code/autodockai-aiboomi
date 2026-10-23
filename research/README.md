# Parking pain research

Evidence for the "user problem" part of the pitch: real complaints about the
lack of parking in Kozhikode, Kochi, the rest of Kerala and other Indian cities,
each linked to the original Reddit post, forum thread or news report.

Open `site/index.html` in a browser. It has the data inlined, so no server is needed.

## Rebuild

```sh
cp .env.example .env        # add your SerpAPI key
npm install
npm run collect             # SerpAPI searches, cached in data/raw/ (one search per query)
npm run normalize           # dedupe into data/items.json
# pass 1: data/chunks/in-N.json -> out-N.json (AI agents: relevance, city, category)
# pass 2: data/strict/in-N.json  -> out-N.json (AI agents: keep only problems people faced)
npm run build               # data/candidates.json, data/posts.json, site/index.html
```

- `scripts/queries.mjs`: the search queries. The free SerpAPI plan allows 250 searches a month, and cached queries are skipped.
- `data/chunks/out-*.json`: keep or drop decisions, city, problem type and a one-line summary per item. Summaries come from the search title and snippet only.
- `data/strict/out-*.json`: the stricter second pass. Announcements, policy news and neutral tips are dropped, so only problems someone actually faced remain. Ids are indexes into `data/candidates.json`.
- The page groups cards by problem, biggest group first. Widely covered incidents (see `INCIDENTS` in `scripts/build.mjs`) collapse into one card with links to the other reports.
- Reddit blocks unauthenticated JSON requests, so post bodies are not fetched.
