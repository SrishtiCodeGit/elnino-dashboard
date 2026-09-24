import fs from "node:fs";
import path from "node:path";
import { HomeMapExperience } from "@/components/HomeMapExperience";
import {
  getCommodities,
  getBonds,
  getElNinoEvents,
  getOni,
  downsample,
  computeNationalPulse,
  getTopRisks,
  getSupplyChainFlows,
  getWildfireStats,
  getWildfireByYear,
  getLivestockPrices,
  getFinancialMarkets,
  quarterlyPhaseReturns,
} from "@/lib/data";
import { fetchLiveOni } from "@/lib/liveOni";
import { getLiveStateImpact } from "@/lib/liveImpact";
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
  // Static research baseline + live NWS alerts and Drought Monitor overlay
  // (see lib/liveImpact.ts). Either feed failing just drops its adjustment.
  const { states: stateImpact, signals } = await getLiveStateImpact();
  const impactByAbbr = Object.fromEntries(stateImpact.map((s) => [s.abbr, s]));
  const commodities = downsample(getCommodities(), 700);
  const bonds = downsample(getBonds(), 700);
  const elNinoEvents = getElNinoEvents();

  // The ENSO signal is fetched live from NOAA on every request (see
  // lib/liveOni.ts). Falls back to the static ONI file if NOAA is
  // unreachable, so the card never breaks — just goes stale.
  const liveOni = await fetchLiveOni();
  const pulse = computeNationalPulse(stateImpact, liveOni ?? getOni());
  const topRisks = getTopRisks(stateImpact, 10);
  const supplyChainFlows = getSupplyChainFlows();
  const wildfireStats = getWildfireStats();
  const wildfireByYear = getWildfireByYear();
  const livestockPrices = getLivestockPrices();

  // Real quarterly market returns grouped by ENSO phase — same computation
  // already powering the /markets page, reused here (not reinvented) to
  // connect state-level climate risk to actual market behavior. Insurance
  // and Agriculture are the two sectors most directly exposed to the same
  // climate signal the state risk scores are built from.
  const financialMarkets = getFinancialMarkets();
  const staticOni = getOni();
  const spReturns = quarterlyPhaseReturns(
    financialMarkets.map((r) => ({ date: r.date, value: r.SP500 })),
    staticOni
  );
  const insuranceReturns = quarterlyPhaseReturns(
    financialMarkets.map((r) => ({ date: r.date, value: r.Insurance_ETF })),
    staticOni
  );
  const agricultureReturns = quarterlyPhaseReturns(
    financialMarkets.map((r) => ({ date: r.date, value: r.Agriculture_ETF })),
    staticOni
  );
  const financialMarketsF = downsample(financialMarkets, 700);

  return (
    <HomeMapExperience
      topology={topology}
      impactByAbbr={impactByAbbr}
      commodities={commodities}
      bonds={bonds}
      elNinoEvents={elNinoEvents}
      pulse={pulse}
      pulseIsLive={liveOni !== null}
      liveStatus={{
        alerts: signals.alerts !== null,
        drought: signals.drought !== null,
        droughtWeekOf: signals.droughtWeekOf,
      }}
      topRisks={topRisks}
      supplyChainFlows={supplyChainFlows}
      wildfireStats={wildfireStats}
      wildfireByYear={wildfireByYear}
      livestockPrices={livestockPrices}
      financialMarkets={financialMarketsF}
      spReturns={spReturns}
      insuranceReturns={insuranceReturns}
      agricultureReturns={agricultureReturns}
    />
  );
}
