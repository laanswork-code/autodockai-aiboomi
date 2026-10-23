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
- `src/scene/`: `Context` (OSM board), `Site` (ground, road, trees), `KtizBuilding`, `Parking`, `RotaryTower`, `Car`
- `src/ui/Hud.tsx`: overlay controls and stats
- `scripts/build-site.mjs`: OSM to local metres

Map data © OpenStreetMap contributors, ODbL. Barlow font © The Barlow Project Authors, SIL OFL (`public/fonts/OFL.txt`).
