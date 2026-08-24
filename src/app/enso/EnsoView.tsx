"use client";

import { PageHeader, SectionLabel, SourceBadge, Kpi, Callout, Card } from "@/components/ui";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { PHASE_COLOR, COLOR } from "@/lib/theme";
import type { OniRecord } from "@/lib/dataUtils";

const PHASE_ORDER = [
  "Super El Nino",
  "Strong El Nino",
  "Moderate El Nino",
  "Weak El Nino",
  "Neutral",
  "La Nina",
];

const MAJOR_EVENTS = [
  { event: "1972-73", peak: "+2.0", duration: "8 months", loss: "~$40 billion", recession: "Yes (1973-75)" },
  { event: "1982-83 (Super)", peak: "+2.2", duration: "14 months", loss: "~$4.1 trillion", recession: "Yes (1981-82)" },
  { event: "1997-98 (Super)", peak: "+2.4", duration: "13 months", loss: "~$5.7 trillion", recession: "No" },
  { event: "2015-16 (Super)", peak: "+2.3", duration: "13 months", loss: "~$3.9 trillion", recession: "No" },
  { event: "2023-24", peak: "+2.0", duration: "9 months", loss: "Pending", recession: "TBD" },
];

export function EnsoView({ oni }: { oni: OniRecord[] }) {
  const latest = oni[oni.length - 1];
  const superCount = oni.filter((r) => r.phase === "Super El Nino").length;
  const peak = oni.reduce((m, r) => Math.max(m, r.ONI), -Infinity);
  const trough = oni.reduce((m, r) => Math.min(m, r.ONI), Infinity);

  const chartData = oni.map((r) => ({
    date: r.date,
    positive: r.ONI > 0 ? r.ONI : 0,
    negative: r.ONI < 0 ? r.ONI : 0,
  }));

  const phaseCounts = PHASE_ORDER.map((p) => ({
    name: p,
    value: oni.filter((r) => r.phase === p).length,
    color: PHASE_COLOR[p],
  })).filter((p) => p.value > 0);

  const colorKey = latest.ONI > 0.5 ? "negative" : latest.ONI < -0.5 ? "positive" : "neutral";

  return (
    <div className="px-6 lg:px-12 py-8 max-w-[1400px]">
      <PageHeader
        title="ENSO Monitor"
        subtitle="Oceanic Nino Index (ONI), the official NOAA measure of El Nino and La Nina intensity"
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="ONI Anomaly" value={`${latest.ONI >= 0 ? "+" : ""}${latest.ONI.toFixed(2)}°C`} sub={latest.date} color={colorKey as "positive" | "negative" | "neutral"} />
        <Kpi label="Current Phase" value={latest.phase} sub="ENSO Classification" />
        <Kpi label="Super El Nino Seasons" value={String(superCount)} sub="Since 1950" color="negative" />
        <Kpi label="Record Peak ONI" value={`+${peak.toFixed(2)}°C`} sub="Historical max" color="negative" />
        <Kpi label="Record La Nina Low" value={`${trough.toFixed(2)}°C`} sub="Historical min" color="positive" />
      </div>

      <SectionLabel>ONI Index Timeline &middot; 1950-2025</SectionLabel>
      <Card>
        <TimeSeriesChart
          data={chartData}
          height={320}
          series={[
            { key: "positive", name: "El Nino", color: COLOR.elNinoDeep, type: "area" },
            { key: "negative", name: "La Nina", color: COLOR.laNinaStrong, type: "area" },
          ]}
          yLabel="ONI Anomaly (°C)"
          referenceLines={[
            { y: 2.0, label: "Super El Nino (+2.0°C)", color: COLOR.elNino },
            { y: 0.5, label: "", color: "rgba(248,113,113,0.35)" },
            { y: -0.5, label: "", color: "rgba(56,189,248,0.35)" },
          ]}
          valueFormatter={(v) => `${v.toFixed(2)}°C`}
        />
        <SourceBadge sources={["NOAA Climate Prediction Center: CPC ONI Dataset (1950-2025)"]} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-4 mt-4">
        <Card>
          <SectionLabel>ENSO Phase Distribution</SectionLabel>
          <DonutChart
            data={phaseCounts}
            centerLabel={{ value: String(oni.length), sub: "seasons" }}
          />
          <SourceBadge sources={["NOAA ONI Dataset"]} />
        </Card>

        <Card>
          <SectionLabel>Major El Nino Events</SectionLabel>
          <div className="overflow-x-auto">
            <table className="w-full text-[0.78rem]">
              <thead>
                <tr className="text-left text-text-muted border-b border-border">
                  <th className="py-2 pr-3 font-medium">Event</th>
                  <th className="py-2 pr-3 font-medium">Peak ONI</th>
                  <th className="py-2 pr-3 font-medium">Duration</th>
                  <th className="py-2 pr-3 font-medium">Est. Global Loss</th>
                  <th className="py-2 font-medium">US Recession</th>
                </tr>
              </thead>
              <tbody>
                {MAJOR_EVENTS.map((e) => (
                  <tr key={e.event} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 text-text-primary font-medium">{e.event}</td>
                    <td className="py-2 pr-3 text-el-nino-strong tabular-nums">{e.peak}</td>
                    <td className="py-2 pr-3 text-text-secondary">{e.duration}</td>
                    <td className="py-2 pr-3 text-text-secondary">{e.loss}</td>
                    <td className="py-2 text-text-secondary">{e.recession}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SourceBadge sources={["Callahan & Mankin (Science, 2023)", "NOAA NCEI"]} />
        </Card>
      </div>

      <Callout>
        <strong className="text-text-primary">Research Context:</strong> The 1982-83 and 1997-98
        Super El Nino events caused an estimated $4.1 trillion and $5.7 trillion in cumulative
        global income losses, with GDP suppression persisting up to 15 years post-event (Callahan
        &amp; Mankin, <em>Science</em>, 2023).
      </Callout>
    </div>
  );
}
