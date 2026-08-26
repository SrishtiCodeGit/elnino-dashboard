"use client";

import { useMemo } from "react";
import { riskColor, emberColor } from "@/lib/theme";
import { severityLabel, livestockCommodities, wildfireLivestockNote, relevantMarketSeries } from "@/lib/dataUtils";
import { STATE_BY_ABBR } from "@/lib/states";
import { TimeSeriesChart, type Series } from "@/components/charts/TimeSeriesChart";
import type { StateImpact, WildfireStats, CommodityRecord, LivestockPriceRecord, CommodityMarketSeries } from "@/lib/dataUtils";

const CHART_PALETTE = ["#B91C1C", "#D97706", "#0EA5E9", "#A78BFA", "#34D399", "#F59E0B"];
const WINDOW_YEARS = 10;

/** Indexes each relevant real commodity series to 100 at the start of a
 * recent window so wildly different units ($/kg beef vs. a wheat futures
 * index) can share one axis — and computes the real % change over that
 * same window as a plain number, not a fabricated dollar-loss figure. */
function buildMarketExposure(
  relevant: CommodityMarketSeries[],
  commodities: CommodityRecord[],
  livestockPrices: LivestockPriceRecord[]
): {
  chartData: Record<string, unknown>[];
  changes: { key: string; label: string; unit: string; pctChange: number | null; color: string }[];
} {
  if (relevant.length === 0) return { chartData: [], changes: [] };

  const allDates = [...commodities.map((c) => c.date), ...livestockPrices.map((p) => p.date)].sort();
  const latest = allDates[allDates.length - 1];
  if (!latest) return { chartData: [], changes: [] };
  const cutoff = new Date(latest);
  cutoff.setFullYear(cutoff.getFullYear() - WINDOW_YEARS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const firstValues: Record<string, number> = {};
  const lastValues: Record<string, number> = {};
  // Keyed by date so multiple commodities sharing the same source (e.g.
  // Corn and Wheat both from `commodities`, same trading dates) merge into
  // one row per date instead of duplicate rows at the same timestamp —
  // Recharts keys ticks by position, and duplicate timestamps produce
  // duplicate React keys.
  const byDate = new Map<string, Record<string, unknown>>();

  for (const m of relevant) {
    const source = (m.source === "livestock" ? livestockPrices : commodities) as unknown as Record<string, unknown>[];
    for (const rec of source) {
      const date = rec.date as string;
      if (date < cutoffStr) continue;
      const raw = rec[m.field] as number | null;
      if (raw == null) continue;
      if (firstValues[m.field] === undefined) firstValues[m.field] = raw;
      lastValues[m.field] = raw;
    }
  }

  for (const m of relevant) {
    const source = (m.source === "livestock" ? livestockPrices : commodities) as unknown as Record<string, unknown>[];
    const base = firstValues[m.field];
    if (base == null) continue;
    for (const rec of source) {
      const date = rec.date as string;
      if (date < cutoffStr) continue;
      const raw = rec[m.field] as number | null;
      if (raw == null) continue;
      const existing = byDate.get(date) ?? { date };
      byDate.set(date, { ...existing, [`idx_${m.field}`]: (raw / base) * 100 });
    }
  }
  const rows = [...byDate.values()].sort((a, b) => (a.date as string).localeCompare(b.date as string));

  const changes = relevant.map((m, i) => {
    const base = firstValues[m.field];
    const last = lastValues[m.field];
    const pctChange = base != null && last != null ? ((last - base) / base) * 100 : null;
    return { key: m.field, label: m.label, unit: m.unit, pctChange, color: CHART_PALETTE[i % CHART_PALETTE.length] };
  });

  return { chartData: rows, changes };
}

export function WildfireLivestockDetail({
  abbr,
  impact,
  wildfire,
  maxAcres,
  commodities,
  livestockPrices,
  onClose,
}: {
  abbr: string;
  impact: StateImpact | undefined;
  wildfire: WildfireStats;
  maxAcres: number;
  commodities: CommodityRecord[];
  livestockPrices: LivestockPriceRecord[];
  onClose: () => void;
}) {
  const stateName = STATE_BY_ABBR[abbr]?.name ?? abbr;
  const score = impact?.financialRiskScore ?? null;
  const riskColorValue = score != null ? riskColor(score) : "#94a3b8";
  const fireColor = emberColor(wildfire.avgAnnualAcres / maxAcres);
  const livestock = impact ? livestockCommodities(impact) : [];
  const note = impact ? wildfireLivestockNote(impact, wildfire) : null;

  const relevant = useMemo(() => (impact ? relevantMarketSeries(impact) : []), [impact]);
  const { chartData, changes } = useMemo(
    () => buildMarketExposure(relevant, commodities, livestockPrices),
    [relevant, commodities, livestockPrices]
  );
  const marketChartSeries: Series[] = useMemo(
    () =>
      changes.map((c) => ({
        key: `idx_${c.key}`,
        name: c.label,
        color: c.color,
        type: "line",
        yAxisId: "left",
      })),
    [changes]
  );

  return (
    <div className="light-cards fixed inset-0 z-40 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-fade" onClick={onClose} />

      <div className="modal-pop relative w-full max-w-lg max-h-[85vh] rounded-xl border border-border-strong bg-elevated shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border">
          <div>
            <div className="text-[0.62rem] font-mono font-semibold uppercase tracking-widest text-text-muted mb-1">
              Wildfire &amp; Livestock Impact
            </div>
            <h2 className="text-lg font-bold tracking-tight text-text-primary">{stateName}</h2>
            <p className="text-[0.78rem] text-text-secondary mt-0.5">{impact?.region ?? ""}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 shrink-0 rounded-full border border-border-strong bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="5" x2="19" y2="19" />
              <line x1="19" y1="5" x2="5" y2="19" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-surface px-4 py-3">
              <div className="text-[0.62rem] font-mono uppercase tracking-widest text-text-muted mb-1">
                Avg. Annual Acres Burned
              </div>
              <div className="text-xl font-extrabold font-mono tabular-nums" style={{ color: fireColor }}>
                {Math.round(wildfire.avgAnnualAcres).toLocaleString()}
              </div>
              <div className="text-[0.66rem] text-text-muted mt-0.5">
                {wildfire.fireCount.toLocaleString()} fires &middot; {wildfire.yearsCovered}yr avg (NIFC)
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface px-4 py-3">
              <div className="text-[0.62rem] font-mono uppercase tracking-widest text-text-muted mb-1">
                Financial Risk Score
              </div>
              <div className="text-xl font-extrabold font-mono tabular-nums" style={{ color: riskColorValue }}>
                {score ?? "—"}
                <span className="text-xs text-text-muted">/100</span>
              </div>
              {score != null && (
                <div
                  className="text-[0.66rem] font-semibold uppercase tracking-wide mt-0.5"
                  style={{ color: riskColorValue }}
                >
                  {severityLabel(score)}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="text-[0.62rem] font-mono font-semibold uppercase tracking-widest text-text-muted mb-2">
              Livestock &amp; Poultry Exposure
            </div>
            {livestock.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {livestock.map((c) => (
                  <span
                    key={c}
                    className="text-xs px-3 py-1.5 rounded-full border"
                    style={{ borderColor: "#7DD3FC", color: "#0369A1", background: "rgba(125,211,252,0.12)" }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[0.78rem] text-text-muted">
                No livestock or poultry commodity tracked for {stateName} in this dataset.
              </p>
            )}
          </div>

          <div>
            <div className="text-[0.62rem] font-mono font-semibold uppercase tracking-widest text-text-muted mb-2">
              Market Exposure — Real Price History ({WINDOW_YEARS}yr)
            </div>
            {changes.length > 0 ? (
              <>
                <TimeSeriesChart
                  data={chartData}
                  series={marketChartSeries}
                  height={160}
                  yLabel="Index (start=100)"
                  valueFormatter={(v) => v.toFixed(0)}
                  light
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {changes.map((c) => (
                    <span
                      key={c.key}
                      className="text-[0.7rem] font-mono font-semibold px-2.5 py-1 rounded-full border tabular-nums"
                      style={{ borderColor: c.color, color: c.color, background: `${c.color}1a` }}
                    >
                      {c.label} {c.pctChange == null ? "—" : `${c.pctChange >= 0 ? "+" : ""}${c.pctChange.toFixed(0)}%`}
                    </span>
                  ))}
                </div>
                <p className="text-[0.66rem] text-text-muted leading-relaxed mt-2">
                  Real market prices for the commodities {stateName} is actually tracked as exposed to — indexed to
                  100 at the start of the window so different units are comparable. Not a wildfire-specific loss
                  estimate for {stateName}; no such state-level dataset exists.
                </p>
              </>
            ) : (
              <p className="text-[0.78rem] text-text-muted">
                None of {stateName}&rsquo;s tracked commodities have a real market price series in this dataset.
              </p>
            )}
          </div>

          {note && (
            <div className="rounded-lg border-l-[3px] px-4 py-3 bg-elevated" style={{ borderLeftColor: fireColor }}>
              <div
                className="text-[0.62rem] font-mono font-semibold uppercase tracking-widest mb-1"
                style={{ color: fireColor }}
              >
                Why This Matters
              </div>
              <p className="text-[0.8rem] text-text-secondary leading-relaxed">{note}</p>
            </div>
          )}

          {impact?.climateNote && (
            <div className="rounded-lg border border-border bg-surface px-4 py-3">
              <div className="text-[0.62rem] font-mono font-semibold uppercase tracking-widest text-text-muted mb-1">
                El Nino Climate Pattern
              </div>
              <p className="text-[0.78rem] text-text-secondary leading-relaxed">{impact.climateNote}</p>
            </div>
          )}

          <p className="text-[0.66rem] text-text-muted leading-relaxed pt-2 border-t border-border">
            Acreage is real NIFC InterAgencyFirePerimeterHistory data (2005-2024) — see{" "}
            <span className="font-mono">data/wildfire_stats_README.md</span>. Risk score and climate reasoning are
            this state&rsquo;s own research-composite figures, the same ones shown elsewhere in this dashboard.
            Market prices are real (see <span className="font-mono">data/livestock_prices_README.md</span> for
            Beef/Chicken sourcing). No state-specific livestock financial-loss figure is shown because no real
            dataset for that exists.
          </p>
        </div>
      </div>
    </div>
  );
}
