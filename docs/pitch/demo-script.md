# 3-Minute Demo Script

Numbers come from the simulation run (`ksum-3d/sim/results.json`, seed 42). Say "simulated" every time you quote one.

## 0:00 to 0:20 · Hook

> Across Kerala and India there is nowhere to park and nowhere to charge: we found 474 real complaints, 154 of them in Kerala. One example: the Kerala Startup Mission in Kalamassery, 9:40 on a weekday. A driver with 4% battery has circled this strip three times. Fifteen bays, all full, no chargers. She parks on the road and walks.

*(Screen: 3D site, **Today** mode, Street view: the full paver strip.)*

## 0:20 to 0:50 · Problem, then the solution in one sentence

> From Kochi to Delhi NCR: more EVs than sockets, no spare land, and parking and charging are two separate errands. Robotaxi fleets will need unattended depots on top of that.
>
> **We are building the AI intelligence layer for smart parking, and for the autonomous parking infrastructure that comes next.** AutoDock already builds rotary towers with a charger in every bay. **We built the brain: Jev decides what happens to every car, bay and kilowatt, with a confidence it can stand behind, and asks a human when it isn't sure.**

*(Switch to **With AutoDock**: two towers on four bays, 40 cars.)*

## 0:50 to 1:50 · Live demo

1. Click **Rush hour**. Cars arrive one by one.
2. Point at a decision card:
   > Read the card aloud: the driver's note, the pallet Jev picked and why (near the door for a short stay, deep in the loop for a long one), and the charge plan with its battery level. Each answer has a confidence bar; charge and anomaly checks act on their own above the tick, bay and price always act on Jev's best answer.
3. Wait for the escalation (camera misread or pending payment):
   > Here the camera read the plate differently from the booking. Jev isn't sure, so it doesn't guess: it goes to the operator queue. Approve.
4. Show the tower rotating that pallet to the door, then the driver phone: dock, charging plan, pay by UPI.

## 1:50 to 2:20 · Evidence

> Same simulated rush hour, same 108 cars, rules versus Jev:

| Simulated, rush hour, seed 42 | Rules | Jev |
|---|---|---|
| Grid peak | 60 kW (at the limit) | **42.6 kW (29% lower)** |
| Energy cost | ₹2,989 | **₹2,278 (24% lower)** |
| Real anomalies missed | 0 | **0** |
| Cars sent to an operator | 22 | 21 |
| Average wait | 8.4 min | 9.0 min |
| kWh delivered | 590 | 495 |

> Jev keeps the site under its grid connection by moving charging to solar and off-peak, catches every real plate and payment problem, and only calls a person about as often as the rules do. The trade-off: it sells less energy during the day. On a site where the grid connection is the bottleneck, that is the trade you want.
>
> Each decision costs about $0.00008, so we can afford to decide on every single event. If Jev is down, rules take over and every decision is in the audit log.

*(If asked: the rules flag every camera misread as an anomaly; Jev tells a misread O-for-0 from a different car, and still catches wrong cars at 98%.)*

## 2:20 to 3:00 · Business and the ask

> Revenue: per-session fee, per-bay software subscription, energy margin and a landowner share. First pilot in Kerala, then Kochi, Trivandrum and Kozhikode; fleets and robotaxi depots after that.
>
> [LOI status: AutoDock AI integration letter, site owner pilot letter.]
>
> **The ask:** [a pilot site / introductions / funding amount].

## Before going on stage

- [ ] Decision server running (`npm run server`) and the app open in **With AutoDock**, Overview camera
- [ ] One rehearsal where the escalation appears within the first 30 seconds of Rush hour
- [ ] Simulation numbers on the slide match `sim/results.json`, each marked "simulated"
- [ ] Two quotes from real users added to the problem section
