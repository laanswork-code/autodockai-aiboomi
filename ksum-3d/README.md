# AutoDock at KINFRA Hi-Tech Park

A 3D replica of the Kerala Startup Mission building (Kerala Technology
Innovation Zone) at KINFRA Hi-Tech Park, Kalamassery, with two AutoDock rotary
towers placed on the paver parking strip in front of it. Toggle **Today** and
**With AutoDock** to compare the ground each layout needs.

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

## What is real and what is estimated

| Part | Source |
|---|---|
| Surrounding buildings, roads, water | OpenStreetMap via Overpass (`data/osm-site.json`), converted by `npm run site` |
| KSUM building footprint | OSM way 381278453, shifted 8 m north so the lawn, parking strip and road fit (OSM draws the road on the facade) |
| Building heights | Estimated: OSM has almost none here. KSUM is 22 m with a 27 to 30 m west wing, from the photos |
| Facade, atrium, canopy, pylons, KSUM letters, palms | Modelled from the site photos taken 23 Oct 2026 |
| Rotary tower, BYD Seal and Atto 3 | Extracted from the AutoDock Kozhikode Beach demo. Tower scale is calibrated so a pallet is 5.4 m long |
| Parking strip | 15 bays of 2.6 m × 5.5 m, 13 occupied as in the photos |

## Numbers on screen

Computed in `src/lib/stats.ts` from the strip size and the tower footprint
measured from the model at load time: 13 cars on 215 m² today against room for
24 cars on 93 m² with two towers, about 4.3× more cars per square metre, with
121 m² of the strip freed.

## Code map

- `src/store/useSceneStore.ts`: zustand store (mode, camera view, tower spin, measured tower size)
- `src/config/site.ts`: site geometry (facade arc, strip, bays, tower slots, camera presets)
- `src/scene/`: `Context` (OSM board), `Site` (ground, road, trees), `KtizBuilding`, `Parking`, `RotaryTower`, `Car`
- `src/ui/Hud.tsx`: overlay controls and stats
- `scripts/build-site.mjs`: OSM to local metres

Map data © OpenStreetMap contributors, ODbL.
