# AutoDock at KINFRA Hi-Tech Park

A 3D replica of the Kerala Startup Mission building (Kerala Technology
Innovation Zone) at KINFRA Hi-Tech Park, Kalamassery, with two AutoDock rotary
towers placed on the paver parking strip in front of it. It is one example
site for a parking problem found across Kerala and India. Toggle **Today** and
**With AutoDock** to compare the ground each layout needs. Project overview,
submission material and licences: see the [root README](../README.md).

```sh
npm install
npm run server     # Jev decision server on :8788 (needs TYPESAFE_API_KEY in ../.env)
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

## What is real and what is estimated

| Part | Source |
|---|---|
| Surrounding buildings, roads, water | OpenStreetMap via Overpass (`data/osm-site.json`), converted by `npm run site` |
| KSUM building footprint | Curved front from OSM way 381278453, shifted 8 m north so the lawn, strip and road fit; west sawtooth, diagonal west edge and stepped back traced from Google Maps |
| Building heights | Estimated: OSM has almost none here. KSUM is 30 m, with 33 m and 36 m angled blocks at the west end, above the 25 m towers as on site |
| Facade, atrium, canopy, pylons, KSUM letters, palms | Modelled from the site photos taken 23 Oct 2026 |
| Rotary tower, BYD Seal and Atto 3 | Extracted from the AutoDock Kozhikode Beach demo. The loop is stretched from 12 to 20 pallets; scale is set so a pallet is 6.2 m overall (about 4.4 m flat deck), which carries the 4.8 m Seal |
| Parking strip | 15 bays of 2.6 m × 5.5 m, 13 occupied as in the photos |

## Numbers on screen

Computed in `src/lib/stats.ts` from the strip size and the tower footprint
measured from the model at load time: 13 cars on 215 m² today against room for
40 cars on about 123 m² with two 20-pallet towers, about 5.4× more cars per
square metre, with about 92 m² of the strip freed.

## Code map

- `src/store/useSceneStore.ts`: zustand store (mode, camera view, tower spin, measured tower size)
- `src/config/site.ts`: site geometry (facade arc, strip, bays, tower slots, camera presets)
- `src/scene/`: `Context` (OSM board), `Site` (ground, road, trees), `KtizBuilding`, `Parking`, `RotaryTower`, `Car`, `EnergyFlows` (roof solar, grid transformer and live power lines)
- `src/ui/Hud.tsx`: overlay controls and stats
- `src/Root.tsx`, `src/route.ts`, `src/Nav.tsx`: three routes, each lazy loaded: `/` digital twin, `/dashboard` live monitor (polls `/api/health` and `/api/audit`), `/problems` research list (`npm run problems` refreshes `src/data/problems.json` from `../research`)
- `src/pages/`: dashboard and problems pages
- `scripts/build-site.mjs`: OSM to local metres
- `src/control/`: decision contract (`types.ts`), rules policy (`baseline.ts`), event bus (`eventBus.ts`), pipeline wiring (`pipeline.ts`, `api.ts`, `orchestrator.ts`), control room, Jev cost counter (`CostCounter.tsx`), review queue, simulated comparison card
- `src/phone/`: driver phone mockup
- `server/`: Jev decision server (`jev.ts` builds the request and maps answers, `jevDecider.ts` adds timeout, fallback and cache, `jevUsage.ts` counts calls and cost, `audit.ts`, `http.ts`)
- `sim/`: minute-by-minute simulator (`site.ts` assumptions, `arrivals.ts` seeded days, `engine.ts`, `run.ts`)

## Jev decision layer

In **With AutoDock** mode a control room plays a scenario's arrivals through a
decision layer. For every car, TypeSafe's Jev (System One) returns typed
judgments with a calibrated confidence:

| Decision | What Jev answers | Can go to an operator |
|---|---|---|
| Bay | Which free pallet, from up to 6 candidates described in words | Only when both towers are full |
| Charge | Charge now (on rooftop solar first, at a lower rate in solar hours), or wait for off-peak (EVs only) | Below 0.60 |
| Price | Demand score 0-3, rounded to a tier: discount, standard, peak, surge | Never |
| Anomaly | Two yes/no checks: plate mismatch and payment risk | Below 0.50, or flagged |

**When Jev asks a person.** `ESCALATES` and `AUTO_THRESHOLD` in
`src/control/types.ts` set the policy: only decisions where a wrong call costs
the driver or the site go to the operator queue (Approve, or Override with the
rules answer). A misjudged pallet costs a few seconds of rotation and a
misjudged tier a few rupees, so bay and price always act on Jev's best answer.

Confidence counts options with the same outcome together, as the TypeSafe
confidence guide recommends: probability spread across interchangeable pallets
is indifference, not doubt. Bay confidence is the share Jev puts on the chosen
pallet's zone (near the door, 3 steps or fewer, or deep in the loop). Charge
confidence is the share on plans that agree on whether the car reaches 80% by
the time the driver is due back. Anomaly confidence is the weaker of the two
checks, `|2p - 1|`. A plate mismatch of 0.7 or a payment risk of 0.2 or more
flags the car: Jev rates pending payments about 20-40% likely to fail, a real
risk of an unpaid stay. A petrol car's charge, or a site with one or no free
pallet, is decided by rules, so a `RULES` badge can appear inside a Jev set.

**Energy.** Each tower roof carries a solar array and a grid transformer
stands west of the strip. Moving dashes run from both sources to a charging
bus above each tower's door; their thickness and speed follow the live kW from
`siteEnergy` in `useControlStore.ts` (the scenario's solar and grid conditions
plus 7.4 kW per charging pallet). The control room's energy gauge shows the
same numbers: solar, grid draw against the connection limit, and the tariff
now. In the power cut scenario the grid lines turn red and sparse and the gauge
shows the reduced limit. The scenarios' solar figures are site-wide; two tower
roofs alone would hold only a few kWp, so read the roof arrays as a symbol.

**Pipeline.** The control room runs the plan's pipeline over a typed event bus
(`src/control/eventBus.ts`): the scenario player publishes `arrival`; the
decision step (`api.ts`) calls `/api/decide` and publishes `decided`, plus a
`review_requested` per decision held for an operator; the tower orchestrator
(`orchestrator.ts`) is the only part that moves the towers, and turns
`scenario_changed`, `decided` and the operator's `review_resolved` into store
updates the 3D twin renders, announcing `pallet_to_door` and
`charging_started`. The control room's event log shows the newest events in
order.

**Fallback.** `src/control/baseline.ts` is the rules policy: nearest free
pallet, charge any EV below 80% on arrival, peak price
when the queue or occupancy is high and standard otherwise, and flag any plate
mismatch or payment that is not ok. It is the baseline in the comparison and the
fallback whenever Jev errors, times out (4 s total) or answers in a shape that
does not parse. The browser also falls back to it if the decision server is
unreachable, and says so in the control room.

**Audit.** Every `/api/decide` call appends the arrival and the full decision
set to `server/data/audit.jsonl` (git ignored). Read it with
`GET /api/audit?limit=50`.

**Cost per decision.** The control room shows "Jev: N decisions, $X total,
Y ms avg" for the decision server since it started; `GET /api/health` returns
the same totals under `jev`, and every `/api/decide` reply carries them. A
decision is one question Jev answered (an arrival asks three to five in one
call). The SDK reports tokens but not a bill, so cost is decisions times
TypeSafe's published price of about $0.00008 per decision
(`JEV_USD_PER_DECISION` in `server/jevUsage.ts`). Cache hits and rules
fallbacks are not calls and cost nothing; failed calls are counted apart.

**Driver phone.** The *Driver phone* button shows the newest car's journey
(arrive, dock, charge, pay by UPI) from its decisions. Payment is a mock.

### Run it

```sh
npm run server     # decision server on :8788, reads TYPESAFE_API_KEY from ../.env (the key stays server side)
npm run dev        # Vite proxies /api to the server
npm test           # server and simulator tests, no live Jev calls
npm run sim -- --policy both --scenario normal,rush_hour --seed 42
```

`npm run sim` runs seeded synthetic days under the rules baseline and under Jev
and writes `sim/results.json`, which the comparison card in the app imports.
Jev's answers are cached in `server/data/jev-cache.json`, so a re-run of the
same seed replays without new API calls. Without the key it runs baseline only.

### Simulated comparison

**These figures are simulated**, from a synthetic day with illustrative
tariffs, prices and driver behaviour. They are not measurements. The full list
of assumptions is in `sim/site.ts` and in `sim/results.json`, and one click
away on the card in the app. Arrivals run 00:00 to 24:00 and the day continues
to 06:00 so overnight off-peak charging is delivered and billed. Seed 42, live
Jev answers (jev-1.14.0):

| Scenario | Policy | Avg wait min | P90 wait min | kWh | Energy INR | Revenue INR | INR/bay | Grid peak kW | Escalations | Missed anomalies |
|---|---|---|---|---|---|---|---|---|---|---|
| Normal | Rules | 3.30 | 4.58 | 502.9 | 2253 | 23292 | 582 | 44.1 | 14 | 0 |
| Normal | Jev | 3.74 | 5.17 | 496.9 | 2187 | 20984 | 525 | 39.6 | 11 | 0 |
| Rush hour | Rules | 8.38 | 20.00 | 590.3 | 2989 | 30266 | 757 | 60.0 | 22 | 0 |
| Rush hour | Jev | 8.91 | 20.00 | 495.1 | 2278 | 26621 | 666 | 42.6 | 21 | 0 |
| Power cut | Rules | 3.30 | 4.58 | 431.3 | 1752 | 22003 | 550 | 39.4 | 14 | 0 |
| Power cut | Jev | 3.36 | 5.00 | 390.0 | 1442 | 19820 | 495 | 30.3 | 14 | 0 |
| Robotaxi fleet | Rules | 3.33 | 4.75 | 559.1 | 2646 | 25164 | 629 | 60.0 | 18 | 0 |
| Robotaxi fleet | Jev | 3.26 | 4.92 | 469.9 | 1991 | 24179 | 604 | 60.0 | 19 | 0 |

What this shows, honestly: Jev keeps the site well under its grid limit (rush
hour peak 42.6 kW against 60 kW) and spends less on energy, with no missed
anomalies and about as many escalations as the rules. It does that by moving
some charging to off-peak hours and letting cars that charge by day draw
rooftop solar first, so under these assumptions it delivers
fewer kWh within the stay and earns less revenue. Which side of that trade a
site wants is a business choice: grid peak and energy cost matter most where
the connection is the bottleneck.

### Screenshots and slow machines

`?lite` in the URL (e.g. http://localhost:5173/?lite) drops the trees and
shadows and redraws only on change. Use it for headless screenshots on
software WebGL, where the full scene takes minutes per frame.

Map data © OpenStreetMap contributors, ODbL. Barlow font © The Barlow Project Authors, SIL OFL (`public/fonts/OFL.txt`).
