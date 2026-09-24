// Pure, dependency-free types and transforms. Safe to import from Client
// Components. Server-only fs-based loaders live in lib/data.ts — never
// import that module from a "use client" file, even for types, or the
// Node "fs" import gets pulled into the client bundle.

export interface OniRecord {
  date: string;
  season: string;
  year: number;
  ONI: number;
  phase: string;
}

export interface FinancialRecord {
  date: string;
  SP500: number | null;
  VIX: number | null;
  DowJones: number | null;
  Insurance_ETF: number | null;
  Banking_ETF: number | null;
  Financials_ETF: number | null;
  Agriculture_ETF: number | null;
  Gold_ETF: number | null;
  Oil_ETF: number | null;
  Wheat_ETF: number | null;
  Corn_ETF: number | null;
  Coffee_ETF: number | null;
  Cocoa_ETF: number | null;
}

export interface CommodityRecord {
  date: string;
  Wheat_Futures: number | null;
  Corn_Futures: number | null;
  Coffee_Futures: number | null;
  Cocoa_Futures: number | null;
  CrudeOil_Futures: number | null;
  Gold_Futures: number | null;
  NatGas_Futures: number | null;
}

export interface CryptoRecord {
  date: string;
  BTC_price: number | null;
  ETH_price: number | null;
  BNB_price: number | null;
}

export interface BondRecord {
  date: string;
  DGS10: number | null;
  DGS30: number | null;
}

export interface RecessionRecord {
  date: string;
  recession: number;
}

export interface ElNinoEvent {
  start: string;
  end: string;
  label: string;
}

export interface StateImpact {
  state: string;
  abbr: string;
  region: string;
  ensoTempAnomaly: "above_normal" | "below_normal" | "near_normal" | "mixed";
  ensoPrecipAnomaly: "above_normal" | "below_normal" | "near_normal" | "mixed";
  climateNote: string;
  keyCommodities: string[];
  commodityExposure: "high" | "medium" | "low";
  energyExposure: "high" | "medium" | "low" | "none";
  agGdpShare: number | null;
  financialRiskScore: number;
  sources: string[];
  /** Present only when live signals were applied; `financialRiskScore` then
   * already equals `live.baselineScore + live.adjustment` (capped at 100). */
  live?: LiveOverlay;
}

export interface LiveStatus {
  alerts: boolean;
  drought: boolean;
  droughtWeekOf: string | null;
}

export interface LiveOverlay {
  baselineScore: number;
  adjustment: number;
  alertPoints: number;
  droughtPoints: number;
  alerts: { event: string; severity: "Severe" | "Extreme" }[];
  droughtD2Plus: number | null;
  droughtWeekOf: string | null;
}

export interface PhaseReturn {
  phase: string;
  mean: number;
  sem: number;
  count: number;
}

const COMMODITY_KEY_MAP: Record<string, string> = {
  Wheat: "Wheat_Futures",
  Corn: "Corn_Futures",
  Coffee: "Coffee_Futures",
  Cocoa: "Cocoa_Futures",
  "Crude Oil": "CrudeOil_Futures",
  Oil: "CrudeOil_Futures",
  "Natural Gas": "NatGas_Futures",
  Gas: "NatGas_Futures",
  Gold: "Gold_Futures",
};

/** Which tracked futures series are relevant to a state, based on its key commodities + energy exposure. */
export function getTrackedCommodityKeys(impact: StateImpact | null): string[] {
  const keys = Array.from(
    new Set(
      (impact?.keyCommodities ?? [])
        .map((c) => COMMODITY_KEY_MAP[c])
        .filter((v): v is string => !!v)
    )
  );
  if (impact?.energyExposure && impact.energyExposure !== "none") {
    if (!keys.includes("CrudeOil_Futures")) keys.push("CrudeOil_Futures");
    if (!keys.includes("NatGas_Futures")) keys.push("NatGas_Futures");
  }
  return keys;
}

export const FUTURES_KEY_TO_NAME: Record<string, string> = {
  Wheat_Futures: "Wheat",
  Corn_Futures: "Corn",
  Coffee_Futures: "Coffee",
  Cocoa_Futures: "Cocoa",
  CrudeOil_Futures: "Crude Oil",
  Gold_Futures: "Gold",
  NatGas_Futures: "Natural Gas",
};

export const PHASE_ORDER = [
  "Super El Nino",
  "Strong El Nino",
  "Moderate El Nino",
  "Weak El Nino",
  "Neutral",
  "La Nina",
];

export function classifyOni(v: number): string {
  if (v >= 2.0) return "Super El Nino";
  if (v >= 1.5) return "Strong El Nino";
  if (v >= 1.0) return "Moderate El Nino";
  if (v >= 0.5) return "Weak El Nino";
  if (v <= -0.5) return "La Nina";
  return "Neutral";
}

export function severityLabel(score: number): "Low" | "Moderate" | "High" | "Severe" {
  if (score >= 75) return "Severe";
  if (score >= 50) return "High";
  if (score >= 25) return "Moderate";
  return "Low";
}

export interface NationalPulse {
  index: number;
  severity: ReturnType<typeof severityLabel>;
  oniValue: number;
  oniPhase: string;
  oniDate: string;
  trend: "Strengthening" | "Weakening" | "Steady";
  primaryExposure: string[];
  topStates: { abbr: string; score: number }[];
  statesScored: number;
}

/** Every field here is computed from data already in the app — no
 * fabricated numbers (no invented "confidence %", no invented "trend"
 * without a real prior reading to compare against). */
export function computeNationalPulse(states: StateImpact[], oni: OniRecord[]): NationalPulse {
  const scores = states.map((s) => s.financialRiskScore);
  const index = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const latest = oni[oni.length - 1] as OniRecord | undefined;
  const prior = oni.length >= 5 ? oni[oni.length - 5] : undefined;
  let trend: NationalPulse["trend"] = "Steady";
  if (latest && prior) {
    const delta = latest.ONI - prior.ONI;
    if (delta >= 0.15) trend = "Strengthening";
    else if (delta <= -0.15) trend = "Weakening";
  }

  const exposureCounts = new Map<string, number>();
  for (const s of states) {
    if (s.commodityExposure === "high" || s.energyExposure === "high") {
      for (const c of s.keyCommodities) {
        exposureCounts.set(c, (exposureCounts.get(c) ?? 0) + 1);
      }
    }
  }
  const primaryExposure = [...exposureCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name]) => name);

  const topStates = [...states]
    .sort((a, b) => b.financialRiskScore - a.financialRiskScore)
    .slice(0, 4)
    .map((s) => ({ abbr: s.abbr, score: s.financialRiskScore }));

  return {
    index,
    severity: severityLabel(index),
    oniValue: latest?.ONI ?? 0,
    oniPhase: latest?.phase ?? "Neutral",
    oniDate: latest?.date ?? "",
    trend,
    primaryExposure,
    topStates,
    statesScored: states.length,
  };
}

export interface TopRiskItem {
  abbr: string;
  state: string;
  region: string;
  score: number;
  climateNote: string;
  keyCommodities: string[];
}

/** The N highest-scoring states, re-sorted from the same static dataset the
 * map already loaded — a news-feed reading of existing data, not a new
 * source. Each item's "why" is the state's own real, sourced climate note —
 * not a fabricated headline. */
export function getTopRisks(states: StateImpact[], n = 5): TopRiskItem[] {
  return [...states]
    .sort((a, b) => b.financialRiskScore - a.financialRiskScore)
    .slice(0, n)
    .map((s) => ({
      abbr: s.abbr,
      state: s.state,
      region: s.region,
      score: s.financialRiskScore,
      climateNote: s.climateNote,
      keyCommodities: s.keyCommodities,
    }));
}

export interface SupplyChainFlow {
  origin: string;
  destination: string;
  commodityCode: string;
  commodityName: string;
  valueUsdMillions: number;
}

export interface WildfireStats {
  abbr: string;
  avgAnnualAcres: number;
  fireCount: number;
  yearsCovered: number;
}

export interface WildfireYearStats {
  year: number;
  totalAcres: number;
  fireCount: number;
}

export interface LivestockPriceRecord {
  date: string;
  Beef_PriceUsdKg: number | null;
  Chicken_PriceUsdKg: number | null;
}

const LIVESTOCK_COMMODITIES = new Set(["Cattle", "Poultry", "Seafood", "Dairy", "Hay"]);

/** Whether a state's real, already-sourced `keyCommodities` include a
 * livestock/poultry category — no new data, just a read of what's already
 * there. */
export function isLivestockExposed(impact: StateImpact): boolean {
  return impact.keyCommodities.some((c) => LIVESTOCK_COMMODITIES.has(c));
}

export function livestockCommodities(impact: StateImpact): string[] {
  return impact.keyCommodities.filter((c) => LIVESTOCK_COMMODITIES.has(c));
}

export interface CommodityMarketSeries {
  /** The exact label as it appears in a state's real `keyCommodities`. */
  commodity: string;
  /** Display name for the tracked market series (may differ from the
   * commodity name — e.g. "Cattle" the animal is priced/traded as "Beef"). */
  label: string;
  unit: string;
  source: "livestock" | "commodity";
  /** Field name on LivestockPriceRecord or CommodityRecord. */
  field: string;
}

/** Maps a state's real `keyCommodities` to the real, already-sourced price
 * series this app actually tracks (commodities.json's futures series, or
 * livestock_prices.json's Beef/Chicken series). Most `keyCommodities`
 * values (Almonds, Hogs, Soybeans, etc.) have no tracked series and are
 * simply not included — no invented series, no proxy substituted in. */
const COMMODITY_MARKET_MAP: CommodityMarketSeries[] = [
  { commodity: "Cattle", label: "Beef", unit: "$/kg", source: "livestock", field: "Beef_PriceUsdKg" },
  { commodity: "Poultry", label: "Chicken", unit: "$/kg", source: "livestock", field: "Chicken_PriceUsdKg" },
  { commodity: "Corn", label: "Corn", unit: "futures index", source: "commodity", field: "Corn_Futures" },
  { commodity: "Wheat", label: "Wheat", unit: "futures index", source: "commodity", field: "Wheat_Futures" },
  { commodity: "Coffee", label: "Coffee", unit: "futures index", source: "commodity", field: "Coffee_Futures" },
  { commodity: "Crude Oil", label: "Crude Oil", unit: "futures index", source: "commodity", field: "CrudeOil_Futures" },
];

export function relevantMarketSeries(impact: StateImpact): CommodityMarketSeries[] {
  return COMMODITY_MARKET_MAP.filter((m) => impact.keyCommodities.includes(m.commodity));
}

/** A deterministic, template-based note connecting a state's real wildfire
 * history and its real livestock/poultry commodities to documented general
 * mechanisms (heat stress, smoke inhalation, feed/water disruption from
 * drought). No AI call and no invented dollar-loss figure — this project
 * has no real per-state livestock-loss dataset, so it stays qualitative on
 * that specific point rather than fabricating one. */
export function wildfireLivestockNote(impact: StateImpact, wildfire: WildfireStats): string {
  const livestock = livestockCommodities(impact);
  const acres = Math.round(wildfire.avgAnnualAcres).toLocaleString();

  if (livestock.length === 0) {
    return `${impact.state} averages about ${acres} acres burned per year (2005-2024, NIFC), but this dataset doesn't track a livestock or poultry commodity here — wildfire's agricultural transmission channel for this state runs through its other tracked commodities instead, not livestock.`;
  }

  const list = livestock.join(", ");
  return `${impact.state} averages about ${acres} acres burned per year (2005-2024, NIFC) and has real tracked exposure in ${list}. Heat stress is well documented to reduce feed conversion, milk yield, and egg-laying while raising mortality in cattle, dairy, and poultry operations; wildfire smoke is a documented respiratory risk to housed and grazing animals; and the drought conditions that often accompany high-fire years reduce available grazing, feed, and water access. This is a reasoned connection from documented mechanisms and this state's real commodity exposure — not a state-specific livestock financial-loss estimate, since no real dataset for that exists here.`;
}

export interface FlowRiskInfo {
  score: number | null;
  severity: ReturnType<typeof severityLabel> | null;
  climateNote: string | null;
}

/** Tags a real interstate flow's risk using the ORIGIN state's own
 * already-computed financialRiskScore — no separate model invented for
 * supply chains. Callers apply their own color mapping (e.g. `riskColor`
 * from lib/theme) to `score`, keeping this file dependency-free. */
export function flowRiskInfo(
  flow: SupplyChainFlow,
  statesByAbbr: Record<string, StateImpact>
): FlowRiskInfo {
  const origin = statesByAbbr[flow.origin];
  if (!origin) {
    return { score: null, severity: null, climateNote: null };
  }
  return {
    score: origin.financialRiskScore,
    severity: severityLabel(origin.financialRiskScore),
    climateNote: origin.climateNote,
  };
}

/** Downsample a date-indexed series to at most `maxPoints` rows (evenly spaced). */
export function downsample<T>(rows: T[], maxPoints = 800): T[] {
  if (rows.length <= maxPoints) return rows;
  const step = rows.length / maxPoints;
  const out: T[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(rows[Math.floor(i * step)]);
  }
  return out;
}

function quarterKey(dateStr: string): string {
  const d = new Date(dateStr);
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${d.getUTCFullYear()}-Q${q}`;
}

/** Average quarterly % change of a price series, grouped by ENSO phase (quarterly-mean ONI). */
export function quarterlyPhaseReturns(
  priceSeries: { date: string; value: number | null }[],
  oni: OniRecord[]
): PhaseReturn[] {
  const lastByQuarter = new Map<string, number>();
  for (const row of priceSeries) {
    if (row.value == null) continue;
    lastByQuarter.set(quarterKey(row.date), row.value);
  }
  const quarters = [...lastByQuarter.keys()].sort();

  const oniByQuarter = new Map<string, number[]>();
  for (const row of oni) {
    const k = quarterKey(row.date);
    if (!oniByQuarter.has(k)) oniByQuarter.set(k, []);
    oniByQuarter.get(k)!.push(row.ONI);
  }

  const byPhase = new Map<string, number[]>();
  for (let i = 1; i < quarters.length; i++) {
    const prev = lastByQuarter.get(quarters[i - 1])!;
    const curr = lastByQuarter.get(quarters[i])!;
    const oniVals = oniByQuarter.get(quarters[i]);
    if (!oniVals?.length || prev === 0) continue;
    const avgOni = oniVals.reduce((a, b) => a + b, 0) / oniVals.length;
    const phase = classifyOni(avgOni);
    const pctChange = (curr / prev - 1) * 100;
    if (!byPhase.has(phase)) byPhase.set(phase, []);
    byPhase.get(phase)!.push(pctChange);
  }

  const out: PhaseReturn[] = [];
  for (const phase of PHASE_ORDER) {
    const vals = byPhase.get(phase);
    if (!vals?.length) continue;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, vals.length - 1);
    const sem = Math.sqrt(variance) / Math.sqrt(vals.length);
    out.push({ phase, mean, sem, count: vals.length });
  }
  return out;
}

/** Average quarterly % change during El Nino quarters (ONI >= 0.5) vs neutral quarters. */
export function elNinoVsNeutralReturn(
  priceSeries: { date: string; value: number | null }[],
  oni: OniRecord[]
): { elNino: number | null; neutral: number | null } | null {
  const lastByQuarter = new Map<string, number>();
  for (const row of priceSeries) {
    if (row.value == null) continue;
    lastByQuarter.set(quarterKey(row.date), row.value);
  }
  const quarters = [...lastByQuarter.keys()].sort();

  const oniByQuarter = new Map<string, number[]>();
  for (const row of oni) {
    const k = quarterKey(row.date);
    if (!oniByQuarter.has(k)) oniByQuarter.set(k, []);
    oniByQuarter.get(k)!.push(row.ONI);
  }

  const elNinoVals: number[] = [];
  const neutralVals: number[] = [];
  for (let i = 1; i < quarters.length; i++) {
    const prev = lastByQuarter.get(quarters[i - 1])!;
    const curr = lastByQuarter.get(quarters[i])!;
    const oniVals = oniByQuarter.get(quarters[i]);
    if (!oniVals?.length || prev === 0) continue;
    const avgOni = oniVals.reduce((a, b) => a + b, 0) / oniVals.length;
    const pctChange = (curr / prev - 1) * 100;
    if (avgOni >= 0.5) elNinoVals.push(pctChange);
    else neutralVals.push(pctChange);
  }
  if (!elNinoVals.length && !neutralVals.length) return null;
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  return { elNino: avg(elNinoVals), neutral: avg(neutralVals) };
}

export function getRecessionRanges(nber: RecessionRecord[]): { start: string; end: string }[] {
  const ranges: { start: string; end: string }[] = [];
  let start: string | null = null;
  for (const row of nber) {
    if (row.recession === 1 && start === null) {
      start = row.date;
    } else if (row.recession === 0 && start !== null) {
      ranges.push({ start, end: row.date });
      start = null;
    }
  }
  return ranges;
}

export function filterByYearRange<T extends { date: string }>(
  rows: T[],
  startYear: number,
  endYear: number
): T[] {
  return rows.filter((r) => {
    const y = Number(r.date.slice(0, 4));
    return y >= startYear && y <= endYear;
  });
}
