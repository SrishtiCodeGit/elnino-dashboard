"use client";

import { useMemo } from "react";
import { emberColor } from "@/lib/theme";
import { isLivestockExposed } from "@/lib/dataUtils";
import { STATE_BY_ABBR } from "@/lib/states";
import { TimeSeriesChart, type Series } from "@/components/charts/TimeSeriesChart";
import type { StateImpact, WildfireStats, WildfireYearStats, LivestockPriceRecord } from "@/lib/dataUtils";

const WILDFIRE_CHART_SERIES: Series[] = [
  { key: "acresBurned", name: "US Acres Burned (NIFC)", color: "#EA580C", type: "area", yAxisId: "left" },
];

const PRICE_CHART_SERIES: Series[] = [
  { key: "Beef_PriceUsdKg", name: "Beef $/kg", color: "#B91C1C", type: "line", yAxisId: "left" },
  { key: "Chicken_PriceUsdKg", name: "Chicken $/kg", color: "#D97706", type: "line", yAxisId: "left" },
];

function formatAcres(v: number): string {
  return `${Math.round(v).toLocaleString()} ac`;
}

// Raw 8-digit acreage numbers ("12000000") collide with the rotated axis
// title at chart width — compact form for the axis ticks only, tooltip
// keeps the full number via formatAcres.
function formatAcresCompact(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(Math.round(v));
}

function formatPrice(v: number): string {
  return `$${v.toFixed(2)}`;
}

function StateRow({
  stats,
  maxAcres,
  impact,
  onSelect,
  onClose,
}: {
  stats: WildfireStats;
  maxAcres: number;
  impact: StateImpact | undefined;
  onSelect: (abbr: string) => void;
  onClose: () => void;
}) {
  const color = emberColor(stats.avgAnnualAcres / maxAcres);
  const livestock = impact ? isLivestockExposed(impact) : false;
  return (
    <tr
      onClick={() => {
        onSelect(stats.abbr);
        onClose();
      }}
      className="cursor-pointer border-t border-border hover:bg-black/[0.03] transition-colors"
    >
      <td className="px-6 py-3 align-top">
        <div className="text-[0.82rem] font-semibold text-text-primary">
          {STATE_BY_ABBR[stats.abbr]?.name ?? stats.abbr}
        </div>
        {livestock && (
          <span
            className="inline-block mt-1 text-[0.62rem] px-2 py-0.5 rounded-full border"
            style={{ borderColor: "#7DD3FC", color: "#0369A1", background: "rgba(125,211,252,0.12)" }}
          >
            Livestock/poultry exposed
          </span>
        )}
      </td>
      <td className="px-2 py-3 align-top text-right whitespace-nowrap">
        <span className="text-[0.82rem] font-mono font-bold tabular-nums" style={{ color }}>
          {Math.round(stats.avgAnnualAcres).toLocaleString()} ac/yr
        </span>
        <div className="text-[0.62rem] font-mono text-text-muted mt-0.5">{stats.fireCount.toLocaleString()} fires</div>
      </td>
    </tr>
  );
}

export function WildfireRiskSummaryModal({
  stats,
  wildfireByYear,
  livestockPrices,
  impactByAbbr,
  onSelect,
  onClose,
}: {
  stats: WildfireStats[];
  wildfireByYear: WildfireYearStats[];
  livestockPrices: LivestockPriceRecord[];
  impactByAbbr: Record<string, StateImpact>;
  onSelect: (abbr: string) => void;
  onClose: () => void;
}) {
  const sorted = [...stats].filter((s) => s.avgAnnualAcres > 0).sort((a, b) => b.avgAnnualAcres - a.avgAnnualAcres);
  const maxAcres = Math.max(1, ...sorted.map((s) => s.avgAnnualAcres));

  // Two real, independently-sourced series, each on its own simple
  // single-axis chart instead of forced onto one dual-axis plot — acres
  // burned and $/kg are different enough units that combining them made
  // the chart harder to read, not more informative.
  const chartStart = wildfireByYear[0]?.year;
  const chartEnd = wildfireByYear[wildfireByYear.length - 1]?.year;
  const wildfireChartData = useMemo(
    () => wildfireByYear.map((y) => ({ date: `${y.year}-01-01`, acresBurned: y.totalAcres })),
    [wildfireByYear]
  );
  const priceChartData = useMemo(
    () =>
      livestockPrices.map((p) => ({
        date: p.date,
        Beef_PriceUsdKg: p.Beef_PriceUsdKg,
        Chicken_PriceUsdKg: p.Chicken_PriceUsdKg,
      })),
    [livestockPrices]
  );

  return (
    <div className="light-cards fixed inset-0 z-40 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-fade" onClick={onClose} />

      <div className="modal-pop relative w-full max-w-2xl max-h-[85vh] rounded-xl border border-border-strong bg-elevated shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-text-primary">Wildfire &amp; Livestock Risk</h2>
            <p className="text-[0.78rem] text-text-secondary mt-0.5 max-w-lg">
              States ranked by real average annual acres burned (NIFC, 2005-2024). Marked states also carry real
              livestock/poultry commodity exposure.
            </p>
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

        <div className="overflow-y-auto">
          <div className="px-6 pt-5 pb-4">
            <div className="text-[0.62rem] font-mono font-semibold uppercase tracking-widest text-text-muted mb-2">
              US Wildfire Acreage by Year ({chartStart}-{chartEnd})
            </div>
            <TimeSeriesChart
              data={wildfireChartData}
              series={WILDFIRE_CHART_SERIES}
              height={160}
              yLabel="Acres Burned"
              valueFormatter={formatAcres}
              yTickFormatter={formatAcresCompact}
              light
            />
            <p className="text-[0.66rem] text-text-muted leading-relaxed mt-2">
              Real NIFC data, only complete through {chartEnd} — later years are excluded rather than shown as a
              misleading drop to near-zero (see below).
            </p>
          </div>

          <div className="px-6 pb-4 pt-2 border-t border-border">
            <div className="text-[0.62rem] font-mono font-semibold uppercase tracking-widest text-text-muted mb-2">
              Beef &amp; Chicken Prices, 2000-Present (World Bank)
            </div>
            <TimeSeriesChart
              data={priceChartData}
              series={PRICE_CHART_SERIES}
              height={160}
              yLabel="$/kg"
              valueFormatter={formatPrice}
              showLegend
              light
            />
            <p className="text-[0.66rem] text-text-muted leading-relaxed mt-2">
              Shown separately from wildfire acreage above — not evidence that wildfire activity drives these
              commodity prices, many other factors move livestock prices.
            </p>
          </div>

          <table className="w-full text-left border-collapse mt-2">
            <tbody>
              {sorted.map((s) => (
                <StateRow
                  key={s.abbr}
                  stats={s}
                  maxAcres={maxAcres}
                  impact={impactByAbbr[s.abbr]}
                  onSelect={onSelect}
                  onClose={onClose}
                />
              ))}
            </tbody>
          </table>

          <p className="px-6 py-4 text-[0.68rem] text-text-muted leading-relaxed border-t border-border">
            Wildfire: real NIFC InterAgencyFirePerimeterHistory data — see{" "}
            <span className="font-mono">data/wildfire_stats_README.md</span> for sourcing and why the national
            chart stops at {chartEnd}. Beef/Chicken: real World Bank Commodity Markets (&ldquo;Pink Sheet&rdquo;) data — see{" "}
            <span className="font-mono">data/livestock_prices_README.md</span>. Neither is fabricated; this is
            historical activity, not a forecast of this season.
          </p>
        </div>
      </div>
    </div>
  );
}
