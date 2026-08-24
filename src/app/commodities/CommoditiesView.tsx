"use client";

import { useMemo, useState } from "react";
import { PageHeader, SectionLabel, SourceBadge, Kpi, Card } from "@/components/ui";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { BarComparisonChart } from "@/components/charts/BarComparisonChart";
import { YearRangeSlider } from "@/components/YearRangeSlider";
import { COLOR } from "@/lib/theme";
import { filterByYearRange, downsample } from "@/lib/dataUtils";
import type { CommodityRecord, ElNinoEvent } from "@/lib/dataUtils";
import type { LiveQuote } from "@/lib/liveQuotes";

interface CommMeta {
  name: string;
  color: string;
  ticker: string;
}

function safe1yChange(rows: CommodityRecord[], key: keyof CommodityRecord): number {
  const vals = rows.map((r) => r[key] as number | null).filter((v): v is number => v != null);
  if (vals.length < 2) return 0;
  const n = Math.min(252, vals.length - 1);
  return (vals[vals.length - 1] / vals[vals.length - 1 - n] - 1) * 100;
}

export function CommoditiesView({
  commodities,
  commMap,
  elNinoEvents,
  comparison,
  live,
}: {
  commodities: CommodityRecord[];
  commMap: Record<string, CommMeta>;
  elNinoEvents: ElNinoEvent[];
  comparison: { commodity: string; elNino: number | null; neutral: number | null }[];
  live: Record<string, LiveQuote>;
}) {
  const [range, setRange] = useState<[number, number]>([2000, 2025]);
  const [selected, setSelected] = useState<string[]>([
    "Wheat_Futures",
    "Corn_Futures",
    "CrudeOil_Futures",
  ]);

  const filtered = useMemo(
    () => downsample(filterByYearRange(commodities, range[0], range[1]), 700),
    [commodities, range]
  );
  const latest = commodities[commodities.length - 1];

  const headline: (keyof CommodityRecord)[] = ["Wheat_Futures", "Corn_Futures", "CrudeOil_Futures", "Gold_Futures"];

  return (
    <div className="px-6 lg:px-12 py-8 max-w-[1400px]">
      <PageHeader
        title="Commodity Markets"
        subtitle="El Nino disrupts global agriculture, energy, and raw material supply chains"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {headline.map((key) => {
          const meta = commMap[key];
          const liveQ = live[meta.ticker];
          const price = liveQ?.price ?? (latest[key] as number | null) ?? 0;
          const chg = liveQ?.changePercent ?? safe1yChange(commodities, key);
          return (
            <Kpi
              key={key}
              label={`${meta.name} Futures`}
              value={`$${price.toLocaleString(undefined, { maximumFractionDigits: 1 })}`}
              sub={`${chg >= 0 ? "+" : ""}${chg.toFixed(1)}% ${liveQ?.price ? "live" : "vs 1yr ago"}`}
              color={chg >= 0 ? "positive" : "negative"}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-6 mb-1">
        <SectionLabel>Commodity Price History &middot; Shaded = El Nino Windows</SectionLabel>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex flex-wrap gap-2">
          {Object.entries(commMap).map(([key, meta]) => {
            const active = selected.includes(key);
            return (
              <button
                key={key}
                onClick={() =>
                  setSelected((prev) =>
                    prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                  )
                }
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  active
                    ? "border-transparent text-black font-semibold"
                    : "border-border text-text-secondary hover:border-border-strong"
                }`}
                style={active ? { background: meta.color } : undefined}
              >
                {meta.name}
              </button>
            );
          })}
        </div>
        <YearRangeSlider min={2000} max={2025} value={range} onChange={setRange} />
      </div>

      <div className="flex flex-col gap-4">
        {selected.map((key) => {
          const meta = commMap[key];
          return (
            <Card key={key}>
              <div className="text-xs font-semibold text-text-secondary mb-1">{meta.name} Futures (USD)</div>
              <TimeSeriesChart
                data={filtered.map((r) => ({ date: r.date, [key]: r[key as keyof CommodityRecord] }))}
                series={[{ key, name: meta.name, color: meta.color, type: "area" }]}
                elNinoEvents={elNinoEvents}
                height={180}
                valueFormatter={(v) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 1 })}`}
              />
            </Card>
          );
        })}
        {selected.length === 0 && (
          <Card>
            <div className="text-sm text-text-muted text-center py-8">
              Select at least one commodity above to chart its price history.
            </div>
          </Card>
        )}
      </div>
      <SourceBadge sources={["Yahoo Finance via yfinance: Commodity Futures (2000-2025)"]} />

      <SectionLabel>Average Quarterly Price Change &middot; El Nino vs Neutral</SectionLabel>
      <Card>
        <BarComparisonChart
          data={comparison}
          xKey="commodity"
          series={[
            { key: "elNino", name: "El Nino Periods", color: COLOR.elNinoDeep },
            { key: "neutral", name: "Neutral Periods", color: COLOR.neutral },
          ]}
          valueFormatter={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`}
          yLabel="Avg Quarterly Price Change (%)"
          height={340}
        />
        <SourceBadge sources={["Yahoo Finance: Commodity Futures", "NOAA ONI Dataset"]} />
      </Card>
    </div>
  );
}
