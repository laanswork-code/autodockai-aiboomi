# AutoDock Market Intelligence Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build a polished, evidence-led AutoDock market-intelligence dashboard with reproducible Python/SerpApi research, editable market and depot models, and the twelve requested research deliverables.

**Architecture:** A React/TypeScript/Vite frontend consumes a FastAPI service. A single Python package owns the SerpApi collector, source normalization, scenario calculations, and Markdown/CSV/JSON generation. Versioned research artifacts remain portable files; the API reads derived JSON and does not require a database.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic, requests; React, TypeScript, Vite, Recharts; CSV/JSON/Markdown research artifacts.

**Spec:** `docs/superpowers/specs/2026-10-23-autodock-market-intelligence-dashboard-design.md`

## Global Constraints

- Read `SERPAPI_API_KEY` from the process environment only; never commit it, print it, or save it in raw results, cache keys, logs, or exports.
- Save raw provider responses as JSON, source/prospect and supporting datasets as CSV, and research reports as Markdown.
- Preserve title, URL, publisher, publication date, retrieval timestamp, evidence summary, confidence, and claim type for each material claim.
- Prefer primary sources; label manual research, API search, company claims, estimates, and analyst inference distinctly.
- Do not bypass paywalls; summarize only accessible source content and record when a source cannot be accessed.
- Keep unknown prospect dimensions unscored; never invent fleet sizes, prices, relationships, contacts, pilot results, or MOU status.
- Keep AutoDock website claims separate from independently verified capabilities; preserve the conflicting retrieval-time claims and the supplier/license distinction.
- No live operator API, vehicle control, external outreach, signed MOU, or legal/engineering determination is in scope.
- TAM/SAM/SOM must be bottom-up for robotaxi depot infrastructure and report one-time revenue separately from recurring annual revenue.
- Support offline use from saved research when the API key is absent; collection should fail with clear setup guidance.
- Match the public site’s light neutral visual style and engineering-focused typography while keeping evidence labels and chart units explicit.

## Review Focus

- Missing `SERPAPI_API_KEY`: collection exits with actionable setup guidance and does not reveal a credential — manual check in Task 2.
- SerpApi timeout, HTTP/API error, or rate limit: retries are bounded, errors are summarized, and a prior cache remains usable — manual check in Task 2.
- Duplicate URLs, tracking parameters, or absent publication dates: normalization deduplicates canonical URLs and preserves unknown dates as blank — inspect generated normalized CSVs in Task 2.
- Conflicting/stale company and market claims: source records remain distinct, conflicts show in the evidence UI, and unverified claims are not presented as facts — review source/findings records in Task 3 and the UI in Task 7.
- Zero or implausible editable model inputs: API validation prevents divide-by-zero and presents the bounded input error clearly — manual check in Task 4 and Task 6.

---

### Task 1: Greenfield application shell

**Files:**
- Create: `pyproject.toml`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/autodock/__init__.py`
- Create: `src/autodock/app.py`
- Create: `src/autodock/cli.py`
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/styles.css`
- Create: `README.md`
- Create: `research/README.md`

**Interfaces:**
- Produces the Python import package `autodock`, the `autodock` CLI entry point, the FastAPI `app` object, and a Vite app shell for later tasks.
- `.env.example` contains only `SERPAPI_API_KEY=`; `.gitignore` excludes `.env`, `research/cache/`, and transient build outputs.

- [ ] Create a minimal FastAPI app with `GET /api/health` returning `{"status":"ok"}` and configure Vite to proxy `/api` to the local server.
- [ ] Create the React shell with a sidebar and placeholder routes/sections for Overview, Customers, Market, Depot Economics, Cities, Competition & Risk, Sources, and Go-to-market.
- [ ] Define the neutral brand tokens from the reviewed site, responsive layout, accessible focus states, and typography fallbacks in `styles.css`.
- [ ] Add Python and frontend setup commands, environment-variable setup with a placeholder, and the planned artifact map to the two README files.
- [ ] Manually confirm the README commands are consistent with the package scripts and that `.env.example` contains no credential value.

### Task 2: SerpApi collection and evidence normalization

**Files:**
- Create: `research/queries.yml`
- Create: `research/data/raw/.gitkeep`
- Create: `research/data/normalized/.gitkeep`
- Create: `src/autodock/serpapi.py`
- Create: `src/autodock/normalize.py`
- Create: `src/autodock/research_store.py`
- Create: `src/autodock/schemas.py`
- Modify: `src/autodock/cli.py`
- Modify: `pyproject.toml`
- Modify: `research/README.md`

**Interfaces:**
- `load_queries(path: Path) -> list[SearchQuery]` loads grouped Google Search, Google News, and Google Maps/local query templates.
- `collect_queries(queries: list[SearchQuery], *, max_requests: int) -> CollectionSummary` reads the key from `os.environ`, applies timeout/retry/rate-limit handling, and writes dated raw JSON without credentials.
- `normalize_response(raw: dict, *, query_id: str, retrieved_at: datetime) -> tuple[list[SourceRecord], list[Finding]]` normalizes search leads and attaches provenance.
- `SearchQuery` carries `query_id`, `engine`, `query`, and optional engine parameters; `SourceRecord` and `Finding` use the CSV fields below; `CollectionSummary` reports request/cache counts, written files, and sanitized errors.
- CLI command: `autodock collect --query-group <name> --max-requests <n>`.

- [ ] Add reusable query groups with multiple formulations for depot operations, charging, parking, named operators, automated parking, costs, permits/zoning, partnerships, and infrastructure partners; prioritize recent sources for current status.
- [ ] Implement SerpApi requests with bounded exponential backoff, request timeout, configurable per-run request ceiling, and a filesystem cache keyed by engine/query parameters with no API key in the key.
- [ ] On missing credentials, return a nonzero CLI result with the exact environment variable name and no key value; sanitize response/error metadata before saving.
- [ ] Save each successful response under `research/data/raw/YYYY-MM-DD/<query_id>.json` with query metadata and retrieval timestamp.
- [ ] Normalize source URLs, remove common tracking parameters for deduplication, retain provider URL, and leave unavailable publication dates blank.
- [ ] Manually inspect a small successful collection when `SERPAPI_API_KEY` is configured; separately check the missing-key path with the variable unset, confirm cache reuse, and ensure neither output includes the credential.

### Task 3: Curated evidence corpus and research records

**Files:**
- Create: `research/data/normalized/sources.csv`
- Create: `research/data/normalized/findings.csv`
- Create: `research/data/normalized/prospects.csv`
- Create: `research/data/normalized/buyers.csv`
- Create: `research/data/normalized/cities.csv`
- Create: `research/data/normalized/competitors.csv`
- Create: `research/data/normalized/risks.csv`
- Create: `research/data/normalized/assumptions.csv`
- Create: `research/data/normalized/gtm.json`
- Create: `research/data/normalized/interview_questions.csv`
- Create: `research/data/normalized/dashboard.json`
- Create: `research/notes/company-claim-audit.md`
- Create: `research/notes/search-strategy.md`

**Interfaces:**
- `sources.csv` columns: `source_id,title,publisher,url,canonical_url,published_date,retrieved_at,source_type,is_primary,evidence_summary,confidence,claim_type,notes`.
- `findings.csv` columns: `finding_id,claim,evidence_summary,source_ids,claim_type,confidence,as_of_date,conflict_note,research_note`.
- `prospects.csv` includes category, current status, cities, disclosed fleet data/date, infrastructure evidence, five dimension scores/reasons, score coverage, role map, timing trigger, pilot hypothesis, official contact URL, barriers, and source IDs. Unsupported values remain blank.
- `buyers.csv` records economic buyer, budget owner, technical evaluator, operational owner, and procurement/safety roles by customer profile; `gtm.json` and `interview_questions.csv` hold the draft pilot/outreach plan and twenty interview questions.
- `dashboard.json` is a derived, versioned bundle for API/UI reads; CSV files remain portable source artifacts.

- [ ] Build the source ledger from primary sources first, with independent corroboration for high-impact company claims and clearly dated retrieval records.
- [ ] Add the AutoDock website’s public product/fleet/system claims as company claims; capture manufacturer/license statements, Kozhikode pilot wording, the in-development terms disclaimer, lack of established US deployment evidence, and conflicting retrieval-time specifications.
- [ ] Research quantified parking, charging, cleaning, inspection, maintenance, repositioning, capacity/real-estate, empty miles, idle time, utilization, charging downtime, readiness, current depot limits, robotic-parking value, and co-location tradeoffs; state where evidence is operator-specific.
- [ ] Verify current operating/development status, cities, fleet disclosures, expansion, and infrastructure evidence for Waymo, Zoox, Tesla Robotaxi, Motional, Nuro, Aurora, Uber and partners; add commercial parking/depot, EV charging, and fleet-energy prospects as relevant.
- [ ] Document city conditions, competitor/substitute products and deployment proof, public contact channels, and technical/regulatory questions. Risk records cover fleet APIs/permissions, vehicle recognition/handoff, robotic charging compatibility, fire/emergency/building/accessibility, zoning, interconnection/utility capacity, certification, liability, insurance, safety validation, and procurement; separate verified requirements from review questions.
- [ ] Populate ten prospects separated into operators, autonomy developers, fleet owners, and channel/infrastructure partners. Use equal-weight 1–5 dimensions only where source-backed; calculate total over known dimensions and show score coverage. Keep unknown dimensions unscored.
- [ ] Record the twenty interview questions, a first-customer/pilot recommendation, tailored contact rationale, and a non-binding pilot MOU outline with unfilled counterpart terms in the normalized data artifacts.
- [ ] Review every numeric claim for units, date, source ID, and classification; leave unverifiable information explicitly unknown. Do not claim outreach, customer commitment, MOU, or pilot success.

### Task 4: Market sizing and depot economics engine

**Files:**
- Create: `src/autodock/schemas.py`
- Create: `src/autodock/models.py`
- Modify: `research/data/normalized/assumptions.csv`
- Modify: `research/data/normalized/dashboard.json`
- Modify: `src/autodock/schemas.py`

**Interfaces:**
- `calculate_market(inputs: MarketInputs) -> MarketResult` returns conservative/base/aggressive three- and five-year depot counts, one-time deployment revenue by category, and annual recurring revenue by category.
- `calculate_depot_economics(inputs: DepotInputs) -> DepotComparison` returns conventional and automated capex, annual operating costs, cost per served vehicle, annual savings, incremental spend, and payback where defined.
- `calculate_sensitivity(inputs: DepotInputs, dimension: str, values: list[float]) -> list[SensitivityPoint]` supports fleet size, land cost, tower capacity, utilization, charger power, and deployment cost.

- [ ] Define Pydantic input/output schemas with units, allowed ranges, provenance/assumption labels, and validation for zero capacity and invalid negative inputs.
- [ ] Implement a bottom-up market model: addressable operators/cities × potential fleet × vehicles per depot → potential sites; SAM filters to supported geographies/customer profiles; SOM applies explicit 3/5-year adoption assumptions.
- [ ] Keep one-time robotic hardware, depot build/install, and charging hardware/install revenue separate from annual AutoDock OS and operations/service revenue.
- [ ] Implement a conventional-versus-AutoDock depot model that exposes land, construction, parking/tower, charging, utility upgrades, energy/demand charges, staffing/service, operating hours, utilization, throughput, and retrieval-time inputs; distinguish sourced values from editable assumptions.
- [ ] Add sensitivity output for all six requested dimensions and avoid presenting a payback if required cost or savings inputs are missing or non-positive.
- [ ] Manually change each sensitivity input and inspect units/formula output; submit zero/negative boundary values and confirm a useful validation response rather than a crash or divide-by-zero.
- [ ] Write model reports with formulas, scenario ranges, assumptions, and source IDs adjacent to every external numeric input.

### Task 5: Report and export generation

**Files:**
- Create: `src/autodock/reports.py`
- Create: `research/templates/executive-summary.md.j2`
- Create: `research/templates/problem-validation.md.j2`
- Create: `research/templates/customer-prospects.md.j2`
- Create: `research/templates/buyer-maps.md.j2`
- Create: `research/templates/tam-sam-som.md.j2`
- Create: `research/templates/unit-economics.md.j2`
- Create: `research/templates/competitive-landscape.md.j2`
- Create: `research/templates/city-selection.md.j2`
- Create: `research/templates/risk-register.md.j2`
- Create: `research/templates/go-to-market.md.j2`
- Create: `research/templates/customer-interview-questions.md.j2`
- Create: `research/templates/investor-narrative.md.j2`
- Create: `research/templates/pilot-mou-outline.md.j2`
- Modify: `pyproject.toml`
- Modify: `src/autodock/cli.py`
- Modify: `research/README.md`
- Create: `research/reports/*.md`

**Interfaces:**
- `build_reports(data_dir: Path, reports_dir: Path, dashboard_path: Path) -> BuildSummary` generates Markdown from normalized evidence/model outputs and writes the derived dashboard bundle.
- CLI command: `autodock reports build` regenerates the reports and normalized `dashboard.json` without network access.
- CLI command: `autodock export --dataset <name> --format csv|json --output <path>` exports the selected normalized artifact without secret fields.

- [ ] Generate the executive, problem, prospect, buyer-map, TAM/SAM/SOM, unit-economics, competitor, city, regulatory, GTM, 20-question, investor narrative, and pilot MOU outline outputs from normalized records and model results.
- [ ] Render source citations as direct Markdown links with source IDs and publication/retrieval dates; include an explicit as-of date and conflict notes.
- [ ] Export source, prospect, city, competitor, risk, and assumption CSV files; preserve raw SerpApi response JSON under the raw data directory.
- [ ] Manually rebuild reports from saved data while offline and confirm all requested deliverable files and exports exist.

### Task 6: FastAPI data, model, and download endpoints

**Files:**
- Modify: `src/autodock/app.py`
- Modify: `src/autodock/schemas.py`
- Create: `src/autodock/data_access.py`
- Modify: `research/data/normalized/dashboard.json`

**Interfaces:**
- `GET /api/health -> HealthResponse`.
- `GET /api/dashboard -> DashboardData` loads the derived JSON bundle and reports last refresh/source freshness.
- `POST /api/models/market -> MarketResult` calls `calculate_market`.
- `POST /api/models/depot -> DepotComparison` calls `calculate_depot_economics`.
- `GET /api/exports/{artifact_name}` serves only allow-listed CSV/JSON/Markdown research artifacts.

- [ ] Add typed endpoints with readable validation errors and no network dependency for ordinary dashboard use.
- [ ] Return a clear collection status when saved data exists but the SerpApi key is absent; never include key values in API responses.
- [ ] Manually open each endpoint, send valid model inputs, send an invalid boundary input, and download one CSV and one Markdown artifact.

### Task 7: Evidence dashboard and interactive decision views

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`
- Create: `frontend/src/api.ts`
- Create: `frontend/src/types.ts`
- Create: `frontend/src/components/Sidebar.tsx`
- Create: `frontend/src/components/EvidenceBadge.tsx`
- Create: `frontend/src/components/SourceLink.tsx`
- Create: `frontend/src/components/DataTable.tsx`
- Create: `frontend/src/components/ScenarioChart.tsx`
- Create: `frontend/src/views/Overview.tsx`
- Create: `frontend/src/views/Customers.tsx`
- Create: `frontend/src/views/Market.tsx`
- Create: `frontend/src/views/DepotEconomics.tsx`
- Create: `frontend/src/views/Cities.tsx`
- Create: `frontend/src/views/CompetitionRisk.tsx`
- Create: `frontend/src/views/Sources.tsx`
- Create: `frontend/src/views/GoToMarket.tsx`

**Interfaces:**
- `api.ts` exposes typed `getDashboard()`, `calculateMarket(inputs)`, `calculateDepot(inputs)`, and `downloadArtifact(name)` calls.
- View components consume `DashboardData` and model API response types from `types.ts`.
- All claim cards/tables link to source IDs; every chart displays units and labels values as sources or assumptions.

- [ ] Build the executive overview with thesis support/challenge, research freshness, first-customer/city recommendation, pilot outline, and evidence badges.
- [ ] Build the ranked prospect view with role map, dimension scoring/coverage, status, official contact route, pilot rationale, and barriers.
- [ ] Build city, competition, regulatory-risk, source-library, and GTM/interview views with search/filter states and clear unknown/conflict labels.
- [ ] Build the TAM/SAM/SOM controls and conventional-versus-automated depot calculator; sliders/inputs call the model API and update charts and summaries immediately.
- [ ] Add CSV/JSON/Markdown downloads, empty/loading/error states, keyboard navigation, responsive behavior, and visual hierarchy consistent with the AutoDock site.
- [ ] Manually walk the full flow from thesis summary → prospect → source and from edited assumptions → chart → export; inspect one conflict and one unknown field to ensure neither is hidden or presented as fact.

### Task 8: Operating guide and final acceptance review

**Files:**
- Modify: `README.md`
- Modify: `research/README.md`
- Modify: `.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Root README documents installation, server start, research refresh, report build, environment setup, and artifact locations.
- Research README documents SerpApi engines/query groups, request limits, retry/cache behavior, normalized fields, source policy, and offline operation.

- [ ] Confirm commands start the API and frontend, refresh research with `SERPAPI_API_KEY` configured, and build reports offline from saved data.
- [ ] Inspect generated raw JSON, CSVs, dashboard JSON, and Markdown for complete provenance, readable dates, units, confidence/type, and no credentials.
- [ ] Review the twelve research deliverables and the investor narrative against the design acceptance map; list any missing evidence as an open question rather than an invented conclusion.
- [ ] Record the actual current research as-of date, API status, and any missing-key/network limitations in the README and dashboard status.

