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
