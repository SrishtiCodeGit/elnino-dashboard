"use client";

import { useMemo, useState } from "react";
import { PageHeader, SectionLabel, SourceBadge, Kpi, Card } from "@/components/ui";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { BarComparisonChart } from "@/components/charts/BarComparisonChart";
import { YearRangeSlider } from "@/components/YearRangeSlider";
import { COLOR, PHASE_COLOR } from "@/lib/theme";
import { filterByYearRange, downsample } from "@/lib/dataUtils";
import type { FinancialRecord, BondRecord, ElNinoEvent, PhaseReturn } from "@/lib/dataUtils";
import type { LiveQuote } from "@/lib/liveQuotes";

function LiveBadge({ q }: { q?: LiveQuote }) {
  if (!q?.price) return null;
  const up = (q.changePercent ?? 0) >= 0;
  return (
    <span className={`text-xs font-semibold ${up ? "text-green" : "text-el-nino-strong"}`}>
      {up ? "+" : ""}
      {q.changePercent?.toFixed(2)}% live
    </span>
  );
}

export function MarketsView({
  fin,
  bonds,
  elNinoEvents,
  recessionRanges,
  spReturns,
  live,
}: {
  fin: FinancialRecord[];
  bonds: BondRecord[];
  elNinoEvents: ElNinoEvent[];
  recessionRanges: { start: string; end: string }[];
  spReturns: PhaseReturn[];
  live: Record<string, LiveQuote>;
}) {
  const [range, setRange] = useState<[number, number]>([1993, 2025]);
  const finF = useMemo(
    () => downsample(filterByYearRange(fin, range[0], range[1]), 700),
    [fin, range]
  );
  const bondsF = useMemo(
    () => downsample(filterByYearRange(bonds, range[0], range[1]), 700),
    [bonds, range]
  );

  const sp = fin[fin.length - 1]?.SP500 ?? 0;
  const vix = fin[fin.length - 1]?.VIX ?? 0;
  const sp1y = fin.length > 252 && fin[fin.length - 252].SP500
    ? ((sp / (fin[fin.length - 252].SP500 as number) - 1) * 100)
    : 0;

  const liveSp = live["^GSPC"];
  const liveVix = live["^VIX"];
  const liveTnx = live["^TNX"];
  const liveTyx = live["^TYX"];

  const barData = spReturns.map((r) => ({ phase: r.phase, mean: Number(r.mean.toFixed(2)) }));
  const barColors = spReturns.map((r) => PHASE_COLOR[r.phase] ?? COLOR.neutral);

  return (
    <div className="px-6 lg:px-12 py-8 max-w-[1400px]">
      <PageHeader
        title="Financial Markets"
        subtitle="S&P 500, VIX, and Treasury yields during El Nino events (1990-present)"
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi
          label="S&P 500"
          value={(liveSp?.price ?? sp).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          sub={<LiveBadge q={liveSp} />}
        />
        <Kpi
          label="VIX"
          value={(liveVix?.price ?? vix).toFixed(1)}
          color={(liveVix?.price ?? vix) > 20 ? "negative" : "positive"}
          sub="Volatility index"
        />
        <Kpi label="S&P 500 1-Year" value={`${sp1y >= 0 ? "+" : ""}${sp1y.toFixed(1)}%`} color={sp1y >= 0 ? "positive" : "negative"} sub="Trailing 252 days" />
        <Kpi
          label="10Y Treasury"
          value={`${(liveTnx?.price ?? bonds[bonds.length - 1]?.DGS10 ?? 0).toFixed(2)}%`}
          sub="Long-term rate benchmark"
        />
        <Kpi
          label="30Y Treasury"
          value={`${(liveTyx?.price ?? bonds[bonds.length - 1]?.DGS30 ?? 0).toFixed(2)}%`}
          sub="Long bond yield"
        />
      </div>

      <div className="flex items-center justify-between mt-6 mb-1">
        <SectionLabel>S&P 500 Price Index</SectionLabel>
      </div>
      <div className="flex justify-end mb-2">
        <YearRangeSlider min={1990} max={2025} value={range} onChange={setRange} />
      </div>
      <Card>
        <TimeSeriesChart
          data={finF.map((r) => ({ date: r.date, SP500: r.SP500 }))}
          series={[{ key: "SP500", name: "S&P 500", color: COLOR.laNinaStrong }]}
          elNinoEvents={elNinoEvents}
          recessionRanges={recessionRanges}
          yLabel="Index"
          valueFormatter={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        />
        <SourceBadge sources={["Yahoo Finance: ^GSPC", "NBER Recession Dates"]} />
      </Card>

      <SectionLabel>CBOE VIX Volatility Index</SectionLabel>
      <Card>
        <TimeSeriesChart
          data={finF.map((r) => ({ date: r.date, VIX: r.VIX }))}
          series={[{ key: "VIX", name: "VIX", color: COLOR.amber, type: "area" }]}
          elNinoEvents={elNinoEvents}
          height={240}
          yLabel="VIX"
          referenceLines={[{ y: 20, label: "Elevated (20)", color: COLOR.elNino }]}
        />
        <SourceBadge sources={["Yahoo Finance: ^VIX"]} />
      </Card>

      <SectionLabel>10Y &amp; 30Y Treasury Yield — Long-Term Bonds</SectionLabel>
      <Card>
        <TimeSeriesChart
          data={bondsF.map((b) => ({ date: b.date, DGS10: b.DGS10, DGS30: b.DGS30 }))}
          series={[
            { key: "DGS10", name: "10-Year Yield", color: COLOR.violet },
            { key: "DGS30", name: "30-Year Yield", color: COLOR.green },
          ]}
          elNinoEvents={elNinoEvents}
          height={260}
          yLabel="Yield (%)"
          valueFormatter={(v) => `${v.toFixed(2)}%`}
          showLegend
        />
        <SourceBadge sources={["Yahoo Finance: ^TNX, ^TYX (CBOE Treasury Yield Indices)"]} />
      </Card>

      <SectionLabel>Average Quarterly S&amp;P 500 Return by ENSO Phase</SectionLabel>
      <Card>
        <BarComparisonChart
          data={barData}
          xKey="phase"
          series={[{ key: "mean", name: "Avg Quarterly Return", color: COLOR.laNinaStrong }]}
          perBarColors={barColors}
          valueFormatter={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`}
          yLabel="Avg Quarterly Return (%)"
        />
        <SourceBadge sources={["Yahoo Finance (^GSPC)", "NOAA ONI Dataset"]} />
      </Card>
    </div>
  );
}
