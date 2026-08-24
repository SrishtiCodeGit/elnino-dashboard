"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
  Cell,
  LabelList,
} from "recharts";
import { COLOR } from "@/lib/theme";

export interface BarSeries {
  key: string;
  name: string;
  color: string;
}

interface Props {
  data: Record<string, unknown>[];
  xKey: string;
  series: BarSeries[];
  height?: number;
  valueFormatter?: (v: number) => string;
  perBarColors?: string[];
  yLabel?: string;
}

function CustomTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border-strong bg-elevated px-3.5 py-2.5 shadow-xl text-xs">
      <div className="text-text-primary font-semibold mb-1.5">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-text-secondary">{p.name}:</span>
          <span className="font-semibold text-text-primary tabular-nums">
            {valueFormatter ? valueFormatter(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function BarComparisonChart({
  data,
  xKey,
  series,
  height = 300,
  valueFormatter,
  perBarColors,
  yLabel,
}: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 20, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={COLOR.border} vertical={false} />
        <XAxis
          dataKey={xKey}
          stroke={COLOR.textMuted}
          tick={{ fill: COLOR.textMuted, fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: COLOR.border }}
        />
        <YAxis
          stroke={COLOR.textMuted}
          tick={{ fill: COLOR.textMuted, fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: COLOR.border }}
          label={
            yLabel
              ? { value: yLabel, angle: -90, position: "insideLeft", fill: COLOR.textMuted, fontSize: 10 }
              : undefined
          }
          width={54}
        />
        <ReferenceLine y={0} stroke={COLOR.borderStrong} />
        <Tooltip content={<CustomTooltip valueFormatter={valueFormatter} />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        {series.length > 1 && (
          <Legend wrapperStyle={{ fontSize: 11, color: COLOR.textSecondary }} iconType="circle" />
        )}
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {perBarColors &&
              data.map((_, i) => <Cell key={i} fill={perBarColors[i % perBarColors.length]} />)}
            <LabelList
              dataKey={s.key}
              position="top"
              formatter={(v) => {
                if (v == null || typeof v === "boolean") return "";
                const num = typeof v === "number" ? v : Number(v);
                return valueFormatter ? valueFormatter(num) : String(v);
              }}
              style={{ fill: COLOR.textSecondary, fontSize: 10 }}
            />
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
