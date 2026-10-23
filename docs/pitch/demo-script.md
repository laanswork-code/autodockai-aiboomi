# 3-Minute Demo Script

Numbers in **[brackets]** come from the simulation run (`ksum-3d/sim/results.json`). Say "simulated" every time you quote one.

## 0:00 to 0:20 · Hook

> It's 9:40 on a weekday at the Kerala Startup Mission in Kalamassery. A driver with 4% battery has circled this strip three times. Fifteen bays, all full, no chargers. She parks on the road and walks.

*(Screen: 3D site, **Today** mode, Street view: the full paver strip.)*

## 0:20 to 0:50 · Problem, then the solution in one sentence

> More EVs than sockets, no spare land, and parking and charging are two separate errands. Robotaxi fleets will need unattended depots on top of that.
>
> AutoDock already builds rotary towers with a charger in every bay. **We built the brain: Jev decides what happens to every car, bay and kilowatt, with a confidence it can stand behind, and asks a human when it isn't sure.**

*(Switch to **With AutoDock**: two towers on four bays, 40 cars.)*

## 0:50 to 1:50 · Live demo

1. Click **Rush hour**. Cars arrive one by one.
2. Point at a decision card:
   > Jev placed this car on pallet [n] near the door because the note says "back by 6". It is waiting for solar to charge because it has [x] hours and the battery is at [y]%. Each answer has a confidence bar. Above the line it acts on its own.
3. Wait for the escalation (camera misread or pending payment):
   > Here the camera read the plate differently from the booking. Jev isn't sure, so it doesn't guess: it goes to the operator queue. Approve.
4. Show the tower rotating that pallet to the door, then the driver phone: dock, charging plan, pay by UPI.

## 1:50 to 2:20 · Evidence

> Same simulated rush hour, same cars, rules versus Jev:

| Simulated, rush hour | Rules | Jev |
|---|---|---|
| Average wait | [ ] min | [ ] min |
| kWh delivered | [ ] | [ ] |
| Revenue per bay | ₹[ ] | ₹[ ] |
| Grid peak | [ ] kW | [ ] kW |

> Each decision costs about $0.00008, so we can afford to decide on every single event. If Jev is down, rules take over and every decision is in the audit log.

## 2:20 to 3:00 · Business and the ask

> Revenue: per-session fee, per-bay software subscription, energy margin and a landowner share. First pilot in Kerala, then Kochi, Trivandrum and Kozhikode; fleets and robotaxi depots after that.
>
> [LOI status: AutoDock AI integration letter, site owner pilot letter.]
>
> **The ask:** [a pilot site / introductions / funding amount].

## Before going on stage

- [ ] Decision server running (`npm run server`) and the app open in **With AutoDock**, Overview camera
- [ ] One rehearsal where the escalation appears within the first 30 seconds of Rush hour
- [ ] Simulation numbers filled in above and on the slide, each marked "simulated"
- [ ] Two quotes from real users added to the problem section
