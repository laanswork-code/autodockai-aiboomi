# AI Impact Statement

**What the AI does.** For each car arriving at a rotary parking tower, TypeSafe's Jev makes four judgments in one request: which pallet to use, when to charge (now, solar, off-peak), how busy the site is (for price), and whether the plate read or payment looks wrong. Code turns these into actions; Jev never writes free text.

**Model and why.** Jev (System One, via `@typesafe-ai/sdk`) returns typed answers with calibrated probabilities in about half a second, for about $0.00008 a decision. That makes it affordable to decide on every event and to measure how sure it is.

**Data.** Arrivals and tariffs are synthetic and illustrative. Map data is OpenStreetMap (ODbL). Problem research links public posts found with SerpAPI. No personal data is stored beyond demo number plates.

**Guardrails.** Charge and anomaly decisions below a confidence threshold wait for an operator; a flagged plate or payment always does. Any error or timeout falls back to a rules policy. Every decision is audited. 60 tests cover the mapping and fallback.

**Expected impact.** In our simulation (not measured), rush-hour grid peak drops 29% and energy cost 24% with no missed anomalies, at the cost of fewer kWh sold.
