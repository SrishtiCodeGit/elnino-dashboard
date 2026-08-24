import fs from "node:fs";
import path from "node:path";
import { HomeMapExperience } from "@/components/HomeMapExperience";
import {
  getStateImpact,
  getCommodities,
  getBonds,
  getElNinoEvents,
  getOni,
  downsample,
  computeNationalPulse,
} from "@/lib/data";
import { fetchLiveOni } from "@/lib/liveOni";
import type { Topology } from "topojson-specification";

function getTopology(): Topology {
  const raw = fs.readFileSync(
    path.join(process.cwd(), "public", "data", "us-states.json"),
    "utf-8"
  );
  return JSON.parse(raw) as Topology;
}

export default async function Home() {
  const topology = getTopology();
  const stateImpact = getStateImpact();
  const impactByAbbr = Object.fromEntries(stateImpact.map((s) => [s.abbr, s]));
  const commodities = downsample(getCommodities(), 700);
  const bonds = downsample(getBonds(), 700);
  const elNinoEvents = getElNinoEvents();

  // The ENSO signal is fetched live from NOAA on every request (see
  // lib/liveOni.ts); the state-level risk index and exposure aggregates
  // stay sourced from the static research dataset, since there's no live
  // feed for a hand-composed risk score. Falls back to the static ONI file
  // if NOAA is unreachable, so the card never breaks — just goes stale.
  const liveOni = await fetchLiveOni();
  const pulse = computeNationalPulse(stateImpact, liveOni ?? getOni());

  return (
    <HomeMapExperience
      topology={topology}
      impactByAbbr={impactByAbbr}
      commodities={commodities}
      bonds={bonds}
      elNinoEvents={elNinoEvents}
      pulse={pulse}
      pulseIsLive={liveOni !== null}
    />
  );
}
