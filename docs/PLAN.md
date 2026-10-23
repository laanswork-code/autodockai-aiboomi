# Smart Parking Hackathon Plan: Jev-Driven Tower Control Room

## One-line pitch
A Jev-driven operating layer for a rotary parking and EV charging tower, shown through a live 3D digital twin. The tower is the body; Jev is the brain that decides what happens to every car, bay and kilowatt.

## Context
- Event: likely AIBoomi Startup Weekend Kochi, 23 Oct 2026 (confirm). The judging details were not on the AIBoomi page, so this plan uses the rubric you pasted.
- AutoDock AI (Kozhikode, Kerala) already sells rotary towers with an AC fast charger in every bay, plus its own "Laan AI" layer.
- TypeSafe AI's Jev returns typed decisions with calibrated confidence. You set thresholds for when it acts alone and when it escalates to a human. TypeSafe claims about $0.00008 and 0.11s per decision.

## Main risk: Innovation (20)
"Rotary parking with EV charging" already exists. Do not pitch the hardware as your invention. Pitch the **decision layer** and the **simulation evidence** that it beats a naive baseline.

## Jev decisions to showcase
- Bay and level assignment (based on departure time and charge needed)
- Charge now, or wait for solar or off-peak power
- Dynamic price for the slot
- Anomaly check on plate reads and payments, with escalation to an operator when confidence is low

The "escalate when unsure" behavior is your best demo moment.

## Rubric plan

### Technical architecture (25)
- Pipeline: event simulator, event bus, Jev decision service, tower orchestrator, 3D twin
- Rules-based fallback if Jev is unavailable
- Audit log of every decision with its confidence
- Baseline vs Jev comparison on the same rush-hour scenario: average wait, kWh delivered, revenue per bay, grid peak. Label results as simulated.

### User problem relevance (20)
- Problem framing: more EVs than sockets, no spare land, parking and charging as two separate errands, fleets that need unattended depots
- Talk to 2 or 3 real people tonight (apartment residents, mall security) and quote them

### Innovation (20)
- Calibrated, typed decisions with human escalation, instead of an LLM guessing in text
- Cost per decision low enough to decide on every event
- Simulation evidence, not just claims

### UI/UX (15)
Build a control room, not a showpiece.
- 3D tower (Three.js or react-three-fiber): rotation, docking, lift, solar and grid flows
- Jev panel: each decision with a confidence bar and the auto vs needs-review threshold
- Judge-controlled scenario buttons: rush hour, power cut, robotaxi fleet arrives
- Driver phone view: arrive, dock, charge, pay by UPI

### Business (10)
- MOU targets:
  1. AutoDock AI: pilot or integration letter
  2. One site owner (mall, hospital, apartment association, campus): pilot LOI
  - A one-page non-binding letter is enough
- Revenue: per-session fee, per-bay software subscription, energy margin, landowner revenue share
- GTM: one Kerala pilot site, then replicate across Kochi, Trivandrum and Kozhikode; fleets and robotaxi depots later

### Presentation (10)
About 3 minutes:
1. 20-second hook: a car circling for a spot with 4% battery
2. Problem, then the solution in one sentence
3. 60-second live demo: rush-hour toggle, Jev escalating one decision
4. Baseline vs Jev numbers
5. MOU or LOI, business model, the ask

## Build priorities (tonight)
1. Jev API working on a few real decisions (console.typesafe.ai)
2. Simple 3D tower with docking animation
3. Simulation run for the comparison slide
4. Send MOU emails tomorrow morning, in parallel with the build

## Checklist
- [ ] Jev API key and first decision working
- [ ] Simulator producing arrival and charge events
- [ ] Baseline policy vs Jev policy metrics
- [ ] 3D tower scene with scenario buttons
- [ ] Jev decision panel with confidence and escalation
- [ ] Driver phone mockup
- [ ] Two quotes from real users
- [ ] MOU or LOI requests sent
- [ ] Deck and 3-minute demo rehearsed twice

## Sources
- https://aiboomi.org/
- https://autodockai.com/
- https://typesafe.ai/