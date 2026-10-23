# AutoDock Market Intelligence Dashboard — Design

## Intent

Build a research dashboard that helps AutoDock AI decide whether US robotaxi depot infrastructure is an urgent, purchasable problem, who could pay for a first deployment, and what a credible pilot should measure. It must serve as both a polished product demonstration and a reproducible research workspace for founders, prospective customers, and investors.

The company's claims about robotic parking, integrated EV charging, and AutoDock OS are hypotheses. The dashboard must distinguish public evidence from company claims, analyst inference, and model assumptions. It must not imply that planned or simulated features are deployed capabilities.

AutoDock's supplied hypotheses are: (1) robotic/automated parking hardware that increases storage capacity in a limited footprint; (2) EV charging integrated with parking and depot operations; and (3) AutoDock OS for fleet orchestration, vehicle allocation, charging optimization, parking reservations, and deployment readiness. The long-term vision is autonomous depots that reduce operating overhead as robotaxi fleets scale across cities. These are hypotheses, and the research must classify each capability as an existing AutoDock capability, supplier capability, prototype, simulation, or plan.

The company website was reviewed on 2026-10-23: [https://autodockai.com/home](https://autodockai.com/home), plus the public product, system, fleet, physical-AI, infrastructure, technology, partner, early-access, FAQ, and legal pages linked from it. The site describes AutoDock AI as based in Kozhikode, Kerala, and names Shandong Jiuroad as its tower manufacturer. It claims US distribution/usage rights for the supplier's technology. These are company statements, not independently verified findings.

The site presents a product portfolio including rotary parking, AC charging in bays, a proposed Gen 3 DC charging tower with robotic plug-in, fleet integration via REST/MCP, Laan AI orchestration, neighborhood hubs, and safety agents. It claims, among other figures, 8–22 cars on roughly two parking spaces, 21 kW AC charging per rotary bay, retrieval under 90 seconds, and 1,440 kW shared across 20 DC-charging vehicles. Some specifications conflict across pages: the home page says retrieval under 90 seconds, while product listings say roughly 2.5–3 minutes; the site also describes both a current integrated AC rotary tower and a Gen 3 DC tower. Treat all performance, integration, safety, rights, and deployment claims as unverified company claims until corroborated. AutoDock's terms state that products are in development and specifications, capacities, pilot cities, and timelines are indicative and may change. Its early-access page says pilots launch in 2026 starting in Kozhikode; this is not evidence of a launched pilot or US operation. A website enquiry is explicitly not a reservation, offer, contract, or guarantee. The initial product audit must preserve these distinctions and flag discrepancies.

## Goals

- Present an evidence-based executive view of problem urgency and thesis risks.
- Rank ten prospects while separating robotaxi operators, autonomy developers, fleet/infrastructure owners, and channel partners.
- Compare launch cities, alternatives/competitors, technical risks, and regulatory questions.
- Provide editable, bottom-up TAM/SAM/SOM scenarios and a conventional-versus-automated depot unit-economics model.
- Make each material market claim traceable to a source record with URL, publisher, title, publication date, retrieval date, evidence summary, confidence, and claim type.
- Generate raw SerpApi JSON, normalized CSV datasets, and Markdown reports using Python.
- Provide a clear first-customer hypothesis, pilot concept, outreach sequence, interview questions, and investor narrative without presenting these as customer commitments.
- Keep missing or stale data visible. Unknowns must remain unknown rather than being converted into invented scores or facts.

## Non-goals

- Operating a robotaxi fleet, controlling vehicles, charging hardware, parking machinery, or dispatch systems.
- Connecting to private fleet APIs or claiming access to operator data.
- Making legal, engineering, fire-safety, or permitting determinations; the product can record verified requirements and flag review questions.
- Sending outreach, signing an MOU, or representing that a prospect has agreed to a pilot.
- Treating the broad parking market as AutoDock's addressable market.

## Success criteria

1. A founder can move from the thesis summary to a prospect, city, model assumption, or cited source without losing provenance.
2. The initial corpus supports all twelve requested deliverables and distinguishes fact, company claim, estimate, and analyst inference.
3. A user can change key market and depot assumptions and immediately compare conservative, base, and aggressive outcomes.
4. The Python collector reads `SERPAPI_API_KEY` only from the environment, applies request limits/retries/caching, and never writes the key into raw results, logs, exports, or source files.
5. A reproducible command can refresh research when credentials are configured; the dashboard remains usable from its saved corpus when they are not.
6. CSV exports include source and prospect records; raw API responses are saved as JSON; reports are Markdown.

## Approaches considered

1. **Research dashboard plus evidence workspace (selected).** A web interface for decision-making with a Python research pipeline and durable evidence artifacts. This best serves the market-research requirements and the judging rubric's technical architecture, innovation, and UI/UX categories.
2. **Reports-first pipeline.** Build the SerpApi collector and static reports, then add a thin UI. This prioritizes reproducibility but makes it harder to demonstrate an interactive product and scenario exploration.
3. **Pitch-focused microsite.** Present the market narrative and pilot pitch with research as supporting material. This could be presentation-ready quickly, but it would under-serve the requested editable models, prospect diligence, and source audit trail.

The selected direction was chosen by the user. The dashboard is a diligence tool, not a marketing site: claims that fail validation should be visible and allowed to weaken the thesis.

## Product experience

### 1. Executive overview

Show a concise thesis verdict, strongest evidence for and against the market, current research freshness, highest-confidence first-customer segment, recommended launch city, and the smallest pilot proposal. Each statement links to its supporting sources or model assumptions. Use evidence-state labels such as **verified fact**, **company claim**, **estimate**, **analyst inference**, **unknown**, and **planned capability**.

### 2. Customer prospects

Provide a ranked top-ten table with prospect type, current operating status, cities, disclosed fleet scale, infrastructure evidence, timing trigger, likely buyer/evaluator/operations roles, pilot hypothesis, public partnership/contact channel, procurement barriers, and source links. Show a transparent scoring rubric for need, deployment urgency, accessibility, pilot feasibility, and contract potential. Only score dimensions with cited evidence; display unknown dimensions as unscored and show how the total is formed. Separate actual operators from developers, owners, and channel partners.

### 3. Market model

Expose inputs and formulas for relevant operators/cities, potential fleets, vehicles per depot, depot sites, storage/charging capacity, and adoption. Show conservative, base, and aggressive three- and five-year cases. Break revenue into robotic parking hardware, depot construction/installation, charging equipment/installation, recurring software, and operations/service. Keep the addressable market specific to robotaxi depots and label all projections as estimates.

### 4. Depot economics

Compare a conventional depot with an AutoDock-style automated depot. Keep sourced inputs separate from editable assumptions. Include site/land, construction or parking structure, automated parking equipment, chargers and utility upgrades, maintenance, staffing, energy/demand charges, vehicles served, utilization, throughput/retrieval, annual operating cost, one-time deployment spend, and per-vehicle/per-site savings. Provide sensitivity controls for fleet size, land cost, tower capacity, utilization, charger power, and deployment cost. Results should include break-even/payback only where the entered inputs support a meaningful calculation.

### 5. Cities and deployment

Compare San Francisco, Los Angeles, Phoenix, Austin, and any additional city supported by evidence. Show service/development status, fleet/deployment signals, real-estate and utility evidence, permits/zoning signals, candidate partner/site leads, and uncertainty. Do not infer site availability from a map listing.

### 6. Competitive landscape and risk register

Compare automated-parking suppliers, robotic parking/handling, robotaxi depot operators, charging/energy systems, fleet operations software, and real-estate/depot substitutes. Record product, target buyer, deployment evidence, pricing availability, coverage, strengths, limitations, and whether a verified deployment combines storage, charging, and fleet orchestration. Maintain a separate risk register for interfaces, safety, fire access, permitting, electrical service, equipment certification, liability, insurance, and procurement. Mark matters that need legal or engineering review.

### 7. Sources and research

Search and filter the evidence library; inspect excerpts/summaries, source metadata, claim classification, confidence, retrieval date, and any conflict/outdatedness note. Show raw search response links for each collected query where available. Provide downloads for CSV/JSON/Markdown outputs and a visible last-refresh/error status.

### 8. Go-to-market workspace

Present the recommended initial customer profile, role map, pilot scope, success measures, tailored outreach reason, public contact route, and next-30-day actions. Include the 20 highest-value interview questions and a proposed, non-binding pilot MOU outline that identifies open commercial/legal terms. Track MOU status as unknown until supported by evidence. This area creates draft material only; it must not imply that outreach occurred or an MOU exists.

## Research workflow and evidence model

- Search query templates cover the requested subjects and use Google Search, Google News, and Google Maps/local results where supported by SerpApi. Current operating status is searched recently; primary records and authoritative historical sources are retained where still relevant.
- Collection reads `SERPAPI_API_KEY` from the environment at runtime. Requests have a configurable per-run limit, bounded retries with backoff, timeout/error reporting, and a local cache keyed by engine and query parameters. The key is excluded from cache keys and saved artifacts.
- Preserve each successful raw provider response as JSON with a retrieval timestamp and query metadata (excluding credentials). Normalize results into source records; deduplicate by canonical URL and, where needed, title/publisher/date similarity. Conflicting claims remain separate and are called out.
- Each finding points to one or more source IDs and stores a short evidence summary, claim classification, confidence, date context, and analyst note. Do not fabricate excerpts; summarize if source content is inaccessible.
- Search results are leads, not automatic proof. Prefer primary announcements, regulatory filings, official fleet data, city records, and credible independent reporting. Record when a primary source is unavailable.
- The saved corpus supports offline dashboard use and report generation. It must mark whether evidence came from API search, manual research, or analyst modeling.

## AutoDock website baseline

Record the official pages above as company-claim sources, retrieved 2026-10-23. The product evidence ledger must identify the claim as originating from AutoDock and, where the terms/disclaimer is relevant, note that performance and deployment details are forward-looking and indicative. Separate the disclosed supplier relationship and distribution rights from AutoDock-owned technology and from verified operating deployments. The site does not establish a US customer, US pilot, operating tower, signed MOU, or confirmed integration with any named AV operator. Those remain research questions, not negative facts.

## Required research coverage

The product and generated report set must include all requested research outputs below; this list is the acceptance map for the user's full brief.

1. **Executive summary:** strongest evidence supporting and challenging the AutoDock thesis, key uncertainties, recommendation, and as-of date.
2. **Problem validation:** quantify where robotaxis park; charging, cleaning, inspection, maintenance, and repositioning workflows; capacity and real-estate costs; empty miles, idle time, utilization, charging downtime, and readiness; existing depot approaches and limits; robotic-parking impacts; and whether parking/charging should be co-located. Separate operator-specific evidence.
3. **Ten ranked prospects:** separate robotaxi operators from autonomy developers, fleet owners, infrastructure partners, and channels. For each include status/cities/plans, disclosed fleet scale, depot/charging/parking/service arrangements, expansion or capacity signals, buyer/budget owner/evaluator/operations roles, pilot use case, contact route, reason to contact now, and barriers. Score need, urgency, accessibility, pilot feasibility, and contract potential transparently; leave unsupported dimensions unknown.
4. **Personas and buyer maps:** map likely economic buyer, budget owner, technical evaluator, operational owner, and procurement/safety stakeholders for the recommended first customer profile.
5. **Bottom-up TAM/SAM/SOM:** model relevant operators and cities, current/potential fleet, vehicles and parking/charging capacity per depot, depot sites, one-time revenue and recurring revenue by the five requested product/service lines, and conservative/base/aggressive adoption over three and five years. Show formulas, ranges, source-backed facts, and assumptions; exclude broad parking revenue.
6. **Depot economics:** compare conventional and AutoDock-style facilities. Source or explicitly assume land/construction/parking costs, automated parking cost/capacity/maintenance/throughput/retrieval, DC charging and utility costs, demand/energy costs, staffing/service costs, utilization/hours, and possible per-vehicle/site savings. Include sensitivity for fleet size, land, tower capacity, utilization, charger power, and deployment cost.
7. **Competition and substitutes:** cover mechanical/robotic parking, robotaxi depot operations, charging/energy management, fleet orchestration, depot real estate, and third-party fleet services. Compare product, segment, deployment proof, price disclosure, geography, strengths, limitations, and combined-product evidence.
8. **City choice:** compare San Francisco, Los Angeles, Phoenix, Austin, and other evidence-backed candidates on commercial activity/expansion, fleet signals, real-estate, electricity/charging, permitting/zoning, and pilot-site/partner availability. State uncertainties.
9. **Technical/regulatory register:** cover operator APIs and vehicle permissions, fleet-system integration, vehicle recognition/handoff, robotic charging compatibility, fire/emergency/building/accessibility requirements, land use, utility/interconnection, equipment certification, liability, insurance, safety validation, and questions for legal/engineering review. Distinguish verified requirements from open questions.
10. **Outreach plan:** prioritize prospects, provide a tailored evidence-backed contact reason and publicly available official channel, sequence the first contacts, and outline the pilot ask. Do not send outreach or imply agreement.
11. **Customer interview guide:** list the 20 highest-value unanswered questions to resolve with operators, infrastructure owners, utilities, and partners.
12. **Investor narrative:** provide a concise market narrative that separates verified facts from AutoDock hypotheses, analyst inference, and projections.

The business/GTM view should make first-customer and MOU readiness reviewable, but an actual signed MOU requires counterpart engagement and is outside this research product's ability to claim or create.

The accompanying repository must also include a README with setup, environment configuration, example collection/report commands, API usage limits, and output descriptions; reusable search templates; raw JSON; normalized CSVs; source URLs and publication/retrieval dates; evidence summaries and confidence/type labels; and research notes. No paywall bypassing or fabricated information.

## Data and outputs

The canonical records are sources, findings, prospects, cities, competitors, risk items, assumptions, model scenarios, and outreach/pilot recommendations. Every record that makes a factual claim references source IDs. Editable user assumptions remain separate from sourced facts.

The research folder contains:

- `raw/` — dated SerpApi JSON responses.
- `normalized/` — source, finding, prospect, city, competitor, and assumption CSV exports.
- `reports/` — executive summary and the requested problem, customer, market, economics, competitive, city, regulatory, outreach, and investor-narrative Markdown reports.
- `cache/` — bounded local request cache, excluded from version control if it contains large/transient responses.
- `README.md` — environment setup, commands, query/API usage, output schema, and limits.

The dashboard reads generated normalized records and exposes the same data as downloadable CSV. A small local database may be used for app access, but CSV/JSON/Markdown remain the portable source artifacts.

## Technical architecture proposal

- **Frontend:** React with TypeScript and Vite for a responsive, high-contrast research console. Use local model state for scenario exploration and export the selected assumptions/results; no login is needed for the initial demonstration.
- **Backend:** Python with FastAPI and Pydantic schemas for research status, evidence/prospect/model data access, scenario calculations, and exports.
- **Research pipeline:** Python CLI using `requests` against the SerpApi Search API, plus normalization, deduplication, caching, model calculations, and Markdown/CSV/JSON generation.
- **Persistence:** versioned CSV/JSON source artifacts and a lightweight local database/index for dashboard queries. The database is derived and can be rebuilt from normalized data.
- **Charts:** render scenario and comparison visualizations from the underlying editable assumptions; every chart exposes its units and source/assumption basis.
- **Secrets:** `.env` may be used locally but must be ignored by Git; commit only `.env.example` with the variable name and no secret. The process reads `SERPAPI_API_KEY` from the environment and never displays it.
- **External integrations:** SerpApi only for collection. No operator APIs, billing, maps SDK, or outreach integration is in scope.

The repository is currently an empty project shell, so this stack is a proposed greenfield implementation choice. The dashboard's visual tokens should be checked against AutoDock's actual website before final styling because that site could not be reviewed during discovery.

## Constraints and assumptions

- The user's detailed brief is the research specification and defines the requested deliverables.
- The AutoDock website has been reviewed, but its product, performance, rights, integration, and deployment statements remain company claims unless corroborated independently.
- `SERPAPI_API_KEY` is currently absent from the execution environment. Collection must fail with a clear setup message or use saved evidence; no key may be copied from chat into code, files, shell history, or logs.
- Current market facts change quickly. Each source record needs publication and retrieval dates, and reports need an explicit as-of date.
- No public contact details, fleet counts, contract values, pilot outcomes, or MOU status may be invented.
- The financial model is decision support, not an investment recommendation; it must expose assumptions and sources rather than imply precision.
- Keep implementation proportional. Avoid speculative live integrations or unsupported automation of physical infrastructure.

## Open research questions

1. Which AutoDock website claims are live capabilities, supplier capabilities, prototypes, simulations, or plans?
2. Can AutoDock provide supplier-rights documentation, product specifications, prototype/pilot results, safety evidence, and confirmed US integration references that substantiate the website claims?
3. Which operator or depot owner is willing to share actual depot occupancy, charger utilization, dwell, staff, and readiness data?
4. Is the first sellable product a software-only pilot, integration layer, or hardware deployment? The research should recommend one based on evidence; it is not yet established.
5. Which specific site and utility service territory could support a credible first pilot?

## Decisions left to the builder

- Choose the smallest frontend charting and Python persistence libraries that satisfy the experience and keep setup simple.
- Set initial database schemas and exact CSV columns from the canonical records above.
- Match the reviewed site with a light neutral canvas (`#f1f1f0`), Archivo/DM Serif Display/monospace typography where available, and a restrained engineering-console treatment; keep all data labels and chart units explicit.
- Treat unsupported or inaccessible evidence as a research gap and include it in the UI.
