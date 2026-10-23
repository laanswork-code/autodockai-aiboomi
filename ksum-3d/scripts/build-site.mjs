// Converts the raw OpenStreetMap export (data/osm-site.json, fetched from the
// Overpass API) into src/data/site.json in local metres.
// Axes match three.js: x = east, z = south, origin = KTIZ footprint centroid.
// OSM has almost no building heights here, so heights are estimated.
import { readFile, writeFile, mkdir } from "node:fs/promises";

const KTIZ_ID = 381278453;
const raw = JSON.parse(await readFile(new URL("../data/osm-site.json", import.meta.url), "utf8"));
const els = raw.elements.filter((e) => e.geometry?.length);

const ktiz = els.find((e) => e.id === KTIZ_ID);
const lat0 = ktiz.geometry.reduce((a, p) => a + p.lat, 0) / ktiz.geometry.length;
const lon0 = ktiz.geometry.reduce((a, p) => a + p.lon, 0) / ktiz.geometry.length;
const M = 111320;
const kx = M * Math.cos((lat0 * Math.PI) / 180);
const r1 = (v) => Math.round(v * 10) / 10;
const toXZ = (p) => [r1((p.lon - lon0) * kx), r1(-(p.lat - lat0) * M)];

const area = (pts) => Math.abs(pts.reduce((a, [x, z], i) => {
  const [x2, z2] = pts[(i + 1) % pts.length];
  return a + x * z2 - x2 * z;
}, 0)) / 2;

const LEVEL_H = 3.4;
const NAMED_HEIGHT = { 849498815: 18 }; // Sutherland: large multi-storey office
function height(tags, pts) {
  const lv = parseFloat(tags["building:levels"]);
  if (tags.height) return parseFloat(tags.height);
  if (lv) return lv * LEVEL_H + 1;
  const a = area(pts);
  if (a < 60) return 3.5;
  if (a < 250) return 7;
  if (a < 900) return 11;
  return 14;
}

const ROAD_W = { secondary: 9, tertiary: 7.5, tertiary_link: 6, unclassified: 6, residential: 5.5, service: 4.5 };

const buildings = [];
const roads = [];
const water = [];
const green = [];
for (const e of els) {
  const t = e.tags ?? {};
  const pts = e.geometry.map(toXZ);
  if (e.id === KTIZ_ID) continue;
  if (t.building) {
    const ring = pts.at(-1)[0] === pts[0][0] && pts.at(-1)[1] === pts[0][1] ? pts.slice(0, -1) : pts;
    buildings.push({ id: e.id, name: t.name ?? null, h: NAMED_HEIGHT[e.id] ?? r1(height(t, ring)), pts: ring });
  } else if (t.highway && ROAD_W[t.highway]) {
    roads.push({ id: e.id, kind: t.highway, name: t.name ?? null, w: ROAD_W[t.highway], pts });
  } else if (t.natural === "water") {
    water.push({ id: e.id, pts: pts.slice(0, -1) });
  } else if (t.leisure === "park" || t.natural === "grassland") {
    green.push({ id: e.id, pts: pts.slice(0, -1) });
  }
}

const out = {
  source: "© OpenStreetMap contributors (ODbL). Fetched via Overpass API.",
  origin: { lat: lat0, lon: lon0 },
  ktiz: { id: KTIZ_ID, pts: ktiz.geometry.map(toXZ).slice(0, -1) },
  buildings, roads, water, green,
};
await mkdir(new URL("../src/data/", import.meta.url), { recursive: true });
await writeFile(new URL("../src/data/site.json", import.meta.url), JSON.stringify(out));
console.log(`buildings ${buildings.length}, roads ${roads.length}, water ${water.length}, green ${green.length}`);
