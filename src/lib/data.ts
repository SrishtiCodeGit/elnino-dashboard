import fs from "node:fs";
import path from "node:path";
import type {
  OniRecord,
  FinancialRecord,
  CommodityRecord,
  CryptoRecord,
  BondRecord,
  RecessionRecord,
  ElNinoEvent,
  StateImpact,
  SupplyChainFlow,
  WildfireStats,
  WildfireYearStats,
  LivestockPriceRecord,
  BacktestResults,
} from "./dataUtils";

export * from "./dataUtils";

const DATA_DIR = path.join(process.cwd(), "data");
const PROCESSED_DIR = path.join(DATA_DIR, "processed");

function readJson<T>(dir: string, file: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(path.join(dir, file), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const getOni = () => readJson<OniRecord[]>(PROCESSED_DIR, "oni.json", []);
export const getFinancialMarkets = () =>
  readJson<FinancialRecord[]>(PROCESSED_DIR, "financial_markets.json", []);
export const getCommodities = () =>
  readJson<CommodityRecord[]>(PROCESSED_DIR, "commodities.json", []);
export const getCrypto = () => readJson<CryptoRecord[]>(PROCESSED_DIR, "crypto.json", []);
export const getBonds = () => readJson<BondRecord[]>(PROCESSED_DIR, "bonds.json", []);
export const getRecessions = () =>
  readJson<RecessionRecord[]>(PROCESSED_DIR, "nber_recession.json", []);
export const getElNinoEvents = () =>
  readJson<ElNinoEvent[]>(PROCESSED_DIR, "el_nino_events.json", []);
export const getStateImpact = () => readJson<StateImpact[]>(DATA_DIR, "state_impact.json", []);
export const getSupplyChainFlows = () =>
  readJson<SupplyChainFlow[]>(PROCESSED_DIR, "supply_chain_flows.json", []);
export const getWildfireStats = () =>
  readJson<WildfireStats[]>(PROCESSED_DIR, "wildfire_by_state.json", []);
export const getWildfireByYear = () =>
  readJson<WildfireYearStats[]>(PROCESSED_DIR, "wildfire_by_year.json", []);
export const getLivestockPrices = () =>
  readJson<LivestockPriceRecord[]>(PROCESSED_DIR, "livestock_prices.json", []);

export const getBacktestResults = () =>
  readJson<BacktestResults | null>(PROCESSED_DIR, "backtest_results.json", null);

export function getLatestOni() {
  const oni = getOni();
  const latest = oni[oni.length - 1];
  return latest
    ? { value: latest.ONI, phase: latest.phase, date: latest.date }
    : { value: 0, phase: "Neutral", date: "" };
}
