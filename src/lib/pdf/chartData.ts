import { COMMODITY_COLOR, COLOR } from "@/lib/theme";
import { FUTURES_KEY_TO_NAME, getTrackedCommodityKeys } from "@/lib/dataUtils";
import type { CommodityRecord, BondRecord, ElNinoEvent, StateImpact } from "@/lib/dataUtils";

export interface SparklineBand {
  startFrac: number;
  endFrac: number;
}

export interface SparklineSeries {
  key: string;
  name: string;
  color: string;
  unit: string;
  points: number[];
  latestValue: number;
  elNinoBands: SparklineBand[];
}

const MAX_POINTS = 120;

function downsample<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr;
  const step = (arr.length - 1) / (maxPoints - 1);
  const out: T[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(arr[Math.round(i * step)]);
  }
  return out;
}

function bandsFor(dates: string[], events: ElNinoEvent[]): SparklineBand[] {
  if (dates.length < 2) return [];
  const n = dates.length;
  const bands: SparklineBand[] = [];
  for (const event of events) {
    const startIdx = dates.findIndex((d) => d >= event.start);
    if (startIdx === -1) continue;
    let endIdx = dates.findIndex((d) => d >= event.end);
    if (endIdx === -1) endIdx = n - 1;
    if (endIdx <= startIdx) endIdx = Math.min(startIdx + 1, n - 1);
    bands.push({ startFrac: startIdx / (n - 1), endFrac: endIdx / (n - 1) });
  }
  return bands;
}

function seriesFromRecords<T extends { date: string }>(
  records: T[],
  valueKey: keyof T
): { points: number[]; dates: string[] } | null {
  const rows = records
    .map((r) => ({ date: r.date, value: r[valueKey] as number | null }))
    .filter((r): r is { date: string; value: number } => typeof r.value === "number");
  if (rows.length < 2) return null;
  const sampled = downsample(rows, MAX_POINTS);
  return { points: sampled.map((r) => r.value), dates: sampled.map((r) => r.date) };
}

/** Builds real (not fabricated) commodity-futures sparkline series for the
 * commodities this state is actually exposed to, downsampled from the same
 * historical dataset the dashboard's own charts read from. */
export function buildCommodityCharts(
  impact: StateImpact,
  commodities: CommodityRecord[],
  elNinoEvents: ElNinoEvent[]
): SparklineSeries[] {
  const keys = getTrackedCommodityKeys(impact);
  const out: SparklineSeries[] = [];
  for (const key of keys) {
    const name = FUTURES_KEY_TO_NAME[key];
    const built = seriesFromRecords(commodities, key as keyof CommodityRecord);
    if (!built) continue;
    out.push({
      key,
      name,
      color: COMMODITY_COLOR[name] ?? COLOR.violet,
      unit: "$",
      points: built.points,
      latestValue: built.points[built.points.length - 1],
      elNinoBands: bandsFor(built.dates, elNinoEvents),
    });
  }
  return out;
}

/** Real 10-Year Treasury yield series — the same "broader rate environment"
 * chart shown in the state detail panel — for inflation/rate-risk context. */
export function buildTreasuryChart(
  bonds: BondRecord[],
  elNinoEvents: ElNinoEvent[]
): SparklineSeries | null {
  const built = seriesFromRecords(bonds, "DGS10");
  if (!built) return null;
  return {
    key: "DGS10",
    name: "10-Year Treasury Yield",
    color: COLOR.violet,
    unit: "%",
    points: built.points,
    latestValue: built.points[built.points.length - 1],
    elNinoBands: bandsFor(built.dates, elNinoEvents),
  };
}
