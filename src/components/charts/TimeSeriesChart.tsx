"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  Legend,
} from "recharts";
import { COLOR } from "@/lib/theme";
import type { ElNinoEvent } from "@/lib/dataUtils";

export interface Series {
  key: string;
  name: string;
  color: string;
  type?: "line" | "area";
  yAxisId?: "left" | "right";
}

interface Props {
  data: Record<string, unknown>[];
  series: Series[];
  height?: number;
  elNinoEvents?: ElNinoEvent[];
  recessionRanges?: { start: string; end: string }[];
  yLabel?: string;
  yLabelRight?: string;
  referenceLines?: { y: number; label: string; color?: string; yAxisId?: "left" | "right" }[];
  valueFormatter?: (v: number) => string;
  dateFormatter?: (d: string) => string;
  showLegend?: boolean;
  /** Renders on a light card (e.g. the map's state detail panel) instead of
   * the app's default dark surface — axis/grid colors need to flip since
   * Recharts takes raw color props, not CSS classes. */
  light?: boolean;
}

function defaultDateFmt(d: string) {
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function CustomTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: number;
  valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border-strong bg-elevated px-3.5 py-2.5 shadow-xl text-xs">
      <div className="text-text-muted mb-1.5">
        {label ? new Date(label).toLocaleDateString("en-US", { dateStyle: "medium" }) : ""}
      </div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-text-secondary">{p.name}:</span>
          <span className="font-semibold text-text-primary tabular-nums">
            {p.value == null ? "—" : valueFormatter ? valueFormatter(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Time-series chart with a numeric (timestamp) X axis so reference bands
 * (El Nino windows, recessions) position correctly regardless of how the
 * data has been downsampled — a category axis would require an exact
 * date-string match, which downsampling breaks. */
export function TimeSeriesChart({
  data,
  series,
  height = 300,
  elNinoEvents = [],
  recessionRanges = [],
  yLabel,
  yLabelRight,
  referenceLines = [],
  valueFormatter,
  dateFormatter = defaultDateFmt,
  showLegend = false,
  light = false,
}: Props) {
  const hasRightAxis = series.some((s) => s.yAxisId === "right");
  const gridColor = light ? "rgba(15,23,42,0.12)" : COLOR.border;
  const mutedColor = light ? "#64748B" : COLOR.textMuted;
  const secondaryColor = light ? "#475569" : COLOR.textSecondary;

  const tsData = useMemo(
    () => data.map((row) => ({ ...row, _ts: new Date(row.date as string).getTime() })),
    [data]
  );
  const tickFmt = (ts: number) => dateFormatter(new Date(ts).toISOString());

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={tsData} margin={{ top: 8, right: hasRightAxis ? 12 : 24, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={gridColor} vertical={false} />
        <XAxis
          dataKey="_ts"
          type="number"
          domain={["dataMin", "dataMax"]}
          scale="time"
          tickFormatter={tickFmt}
          stroke={mutedColor}
          tick={{ fill: mutedColor, fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: gridColor }}
          minTickGap={40}
        />
        <YAxis
          yAxisId="left"
          stroke={mutedColor}
          tick={{ fill: mutedColor, fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: gridColor }}
          label={
            yLabel
              ? { value: yLabel, angle: -90, position: "insideLeft", fill: mutedColor, fontSize: 10 }
              : undefined
          }
          width={54}
        />
        {hasRightAxis && (
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke={mutedColor}
            tick={{ fill: mutedColor, fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: gridColor }}
            label={
              yLabelRight
                ? { value: yLabelRight, angle: 90, position: "insideRight", fill: mutedColor, fontSize: 10 }
                : undefined
            }
            width={54}
          />
        )}
        <Tooltip content={<CustomTooltip valueFormatter={valueFormatter} />} />
        {showLegend && (
          <Legend wrapperStyle={{ fontSize: 11, color: secondaryColor }} iconType="circle" />
        )}

        {recessionRanges.map((r, i) => (
          <ReferenceArea
            key={`rec-${i}`}
            x1={new Date(r.start).getTime()}
            x2={new Date(r.end).getTime()}
            yAxisId="left"
            fill={mutedColor}
            fillOpacity={0.08}
            strokeWidth={0}
          />
        ))}
        {elNinoEvents.map((ev) => (
          <ReferenceArea
            key={ev.label}
            x1={new Date(ev.start).getTime()}
            x2={new Date(ev.end).getTime()}
            yAxisId="left"
            fill={COLOR.elNino}
            fillOpacity={0.08}
            strokeWidth={0}
          />
        ))}
        {referenceLines.map((rl, i) => (
          <ReferenceLine
            key={`${rl.label || "line"}-${i}`}
            y={rl.y}
            yAxisId={rl.yAxisId ?? "left"}
            stroke={rl.color ?? mutedColor}
            strokeDasharray="4 4"
            label={{ value: rl.label, position: "insideTopRight", fill: rl.color ?? mutedColor, fontSize: 9 }}
          />
        ))}

        {series.map((s) =>
          s.type === "area" ? (
            <Area
              key={s.key}
              yAxisId={s.yAxisId ?? "left"}
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              fill={s.color}
              fillOpacity={0.12}
              strokeWidth={1.6}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ) : (
            <Line
              key={s.key}
              yAxisId={s.yAxisId ?? "left"}
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={1.8}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
