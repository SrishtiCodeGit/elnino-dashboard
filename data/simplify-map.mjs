// Simplifies the states-albers-10m topology (topology-aware, so shared state
// borders stay seamless) to smooth out the extruded 3D map's coastlines and
// borders, which looked jagged/spiky at full 10m vertex density.
// Run: node data/simplify-map.mjs [quantile 0-1, default 0.65]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { presimplify, simplify, quantile } from "topojson-simplify";

const dir = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(dir, "..", "node_modules", "us-atlas", "states-albers-10m.json");
const outPath = path.join(dir, "..", "public", "data", "us-states.json");

const QUANTILE = Number(process.argv[2] ?? 0.3);

const raw = JSON.parse(readFileSync(srcPath, "utf-8"));
const pre = presimplify(raw);
const minWeight = quantile(pre, QUANTILE);
const simplified = simplify(pre, minWeight);

writeFileSync(outPath, JSON.stringify(simplified));

function countPoints(topology) {
  let n = 0;
  for (const arc of topology.arcs) n += arc.length;
  return n;
}

console.log(`quantile=${QUANTILE} minWeight=${minWeight}`);
console.log(`Original arc points: ${countPoints(raw)}`);
console.log(`Simplified arc points: ${countPoints(simplified)}`);
console.log(`Wrote ${outPath}`);
