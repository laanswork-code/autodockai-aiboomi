# SerpApi search run — 2026-10-23

## Run record

- Provider: SerpApi, Google Search and Google News engines, US region, English.
- Query ceiling: 40 requests; 39 succeeded and one returned an API error (`sf_depot_zoning`).
- Unique URLs after tracking-parameter cleanup: 506.
- Raw responses: `research/data/raw/2026-10-23/` (local, ignored by Git).
- Deduplicated lead export: `research/data/normalized/serpapi_search_leads.csv`.
- The credential was read from `SERPAPI_API_KEY` at runtime and was not written to response files, logs, or source files.
- Query set: robotaxi operators and expansions; depot operations and charging; parking and construction costs; AV permits; grid interconnection; competitors; city and infrastructure partners.

## Interpretation

Search results are leads, not proof. The CSV labels every row `search_lead` with low confidence. The curated source ledger and reports use primary sources where available and preserve company claims as claims. Search snippets were not treated as source-page excerpts or independently verified evidence.

The batch did not use Google Maps. A map listing cannot establish that a property is available, zoned, powered, or suitable for a depot, so site availability remains unknown. The failed San Francisco query is visible in the raw manifest; no inference was made from its failure.

## Coverage and limits

The query batch is a first-pass evidence collection, not a full census. It does not provide reliable public fleet counts, vehicle-level depot utilization, charging dwell, empty miles, site costs, automated-parking purchase/maintenance prices, operator API permissions, or confirmed AutoDock integrations. Several cost and operations searches returned vendor pages or broad secondary results. Those remain leads unless the source ledger identifies a directly supporting primary record.

The existing `research/scripts/collect.mjs` was not used: it searches India parking complaints, expects `SERPAPI_KEY`, and does not cover the US robotaxi-depot questions in the market-intelligence spec.
