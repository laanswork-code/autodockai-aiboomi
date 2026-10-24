# AI Impact Statement: form answer

Paste-ready answer for the submission form's "AI Impact Statement" field. The full statement is in
[AI_IMPACT.md](AI_IMPACT.md).

## Full answer

Our agent framework, built on TypeSafe's Jev, runs each AutoDock rotary parking tower. For every arriving car it asks Jev four judgments in one request: which pallet to use, when to charge (now or off-peak), how busy the site is (for price), and whether the plate read or payment looks wrong. Jev returns typed answers with calibrated confidence in about half a second, for about $0.00008 a decision, and never writes free text. Guardrails: low-confidence charge and anomaly decisions, and every flagged plate or payment, wait for a human operator; any error or timeout falls back to a rules policy; every decision is audited, and 76 automated tests cover the mapping and the fallback. Data: arrivals and tariffs are synthetic, map data is OpenStreetMap, and the 474 parking complaints are public posts found with SerpAPI. No personal data is stored beyond demo number plates. Expected impact, in simulation and not yet measured: rush-hour grid peak down 29% and energy cost down 24%, with no missed anomalies. That fits 40 cars with chargers on 4 parking bays, where 4 cars park today.

## Short answer

Our agent, built on TypeSafe's Jev, decides pallet, charging, pricing and plate or payment checks for each car in about half a second; low-confidence or flagged calls go to a human, errors fall back to rules, every decision is logged, and in simulation it cuts rush-hour grid peak 29% and energy cost 24%.
