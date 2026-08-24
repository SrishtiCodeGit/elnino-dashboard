"use client";

import { PageHeader, SectionLabel, SourceBadge, Kpi, Callout, Card } from "@/components/ui";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { BarComparisonChart } from "@/components/charts/BarComparisonChart";
import { COLOR } from "@/lib/theme";
import type { FinancialRecord, ElNinoEvent } from "@/lib/dataUtils";
import type { LiveQuote } from "@/lib/liveQuotes";

function safe1y(rows: FinancialRecord[], key: "Insurance_ETF" | "Banking_ETF" | "SP500"): number {
  const vals = rows.map((r) => r[key]).filter((v): v is number => v != null);
  if (vals.length < 2) return 0;
  const n = Math.min(252, vals.length - 1);
  return (vals[vals.length - 1] / vals[vals.length - 1 - n] - 1) * 100;
}

export function InsuranceView({
  fin,
  elNinoEvents,
  recessionRanges,
  indexed,
  startDate,
  totalReturnByEvent,
  live,
}: {
  fin: FinancialRecord[];
  elNinoEvents: ElNinoEvent[];
  recessionRanges: { start: string; end: string }[];
  indexed: { date: string; Insurance: number | null; Banking: number | null; SP500: number | null }[];
  startDate: string;
  totalReturnByEvent: { event: string; Insurance: number | null; Banking: number | null; SP500: number | null }[];
  live: Record<string, LiveQuote>;
}) {
  const insLive = live["KIE"];
  const bankLive = live["KBE"];

  const insPrice = insLive?.price ?? fin.findLast((f) => f.Insurance_ETF != null)?.Insurance_ETF ?? 0;
  const bankPrice = bankLive?.price ?? fin.findLast((f) => f.Banking_ETF != null)?.Banking_ETF ?? 0;
  const ins1y = safe1y(fin, "Insurance_ETF");
  const bank1y = safe1y(fin, "Banking_ETF");
  const sp1y = safe1y(fin, "SP500");

  return (
    <div className="px-6 lg:px-12 py-8 max-w-[1400px]">
      <PageHeader
        title="Insurance & Banking Sectors"
        subtitle="Assessing whether financial institutions are adequately pricing Super El Nino tail risk"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Insurance ETF (KIE)" value={`$${insPrice.toFixed(2)}`} sub={insLive?.price ? "live" : "SPDR S&P Insurance"} />
        <Kpi label="Banking ETF (KBE)" value={`$${bankPrice.toFixed(2)}`} sub={bankLive?.price ? "live" : "SPDR S&P Bank"} />
        <Kpi label="Insurance 1-Year" value={`${ins1y >= 0 ? "+" : ""}${ins1y.toFixed(1)}%`} sub={`vs S&P 500 ${sp1y >= 0 ? "+" : ""}${sp1y.toFixed(1)}%`} color={ins1y >= 0 ? "positive" : "negative"} />
        <Kpi label="Banking 1-Year" value={`${bank1y >= 0 ? "+" : ""}${bank1y.toFixed(1)}%`} sub={`vs S&P 500 ${sp1y >= 0 ? "+" : ""}${sp1y.toFixed(1)}%`} color={bank1y >= 0 ? "positive" : "negative"} />
      </div>

      <SectionLabel>Relative Performance &middot; Indexed to 100 at {startDate}</SectionLabel>
      <Card>
        <TimeSeriesChart
          data={indexed}
          series={[
            { key: "SP500", name: "S&P 500", color: COLOR.laNinaStrong },
            { key: "Insurance", name: "Insurance ETF (KIE)", color: COLOR.green },
            { key: "Banking", name: "Banking ETF (KBE)", color: COLOR.amber },
          ]}
          elNinoEvents={elNinoEvents}
          recessionRanges={recessionRanges}
          referenceLines={[{ y: 100, label: "Base (100)", color: COLOR.textMuted }]}
          height={340}
          yLabel="Indexed Value"
          showLegend
        />
        <SourceBadge sources={["Yahoo Finance: KIE, KBE, ^GSPC", "NBER Recession Dates"]} />
      </Card>

      <SectionLabel>Total Return During Each El Nino Window</SectionLabel>
      <Card>
        <BarComparisonChart
          data={totalReturnByEvent.map((r) => ({ event: r.event, SP500: r.SP500, Insurance: r.Insurance, Banking: r.Banking }))}
          xKey="event"
          series={[
            { key: "SP500", name: "S&P 500", color: COLOR.laNinaStrong },
            { key: "Insurance", name: "Insurance ETF (KIE)", color: COLOR.green },
            { key: "Banking", name: "Banking ETF (KBE)", color: COLOR.amber },
          ]}
          valueFormatter={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
          yLabel="Total Return (%)"
          height={340}
        />
        <SourceBadge sources={["Yahoo Finance: KIE, KBE, ^GSPC"]} />
      </Card>

      <Callout>
        <strong className="text-text-primary">Hypothesis H3:</strong> If insurance and banking
        sectors systematically underperform the S&amp;P 500 during El Nino windows, it suggests
        these sectors are not fully pricing in climate tail risk in their equity valuations or
        insurance premiums.
      </Callout>
    </div>
  );
}
