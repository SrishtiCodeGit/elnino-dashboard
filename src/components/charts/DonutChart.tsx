"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { COLOR } from "@/lib/theme";

interface Datum {
  name: string;
  value: number;
  color: string;
}

export function DonutChart({
  data,
  height = 260,
  centerLabel,
  onSliceClick,
  light = false,
  animate = false,
}: {
  data: Datum[];
  height?: number;
  centerLabel?: { value: string; sub: string };
  onSliceClick?: (name: string) => void;
  /** Matches the slice-separator stroke to a light card background instead
   * of the app's dark default — COLOR.surface is a hardcoded near-black
   * hex, not a CSS variable, so it doesn't pick up .light-cards scoping on
   * its own and reads as a black outline on a white modal. */
  light?: boolean;
  /** Slices sweep in on open instead of appearing instantly — off by
   * default so existing callers (e.g. a chart that redraws on live data
   * changes) don't get a re-animation on every update. */
  animate?: boolean;
}) {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="85%"
            paddingAngle={1.5}
            stroke={light ? "#ffffff" : COLOR.surface}
            strokeWidth={light ? 1 : 2}
            isAnimationActive={animate}
            animationDuration={900}
            animationEasing="ease-out"
          >
            {data.map((d) => (
              <Cell
                key={d.name}
                fill={d.color}
                onClick={onSliceClick ? () => onSliceClick(d.name) : undefined}
                style={onSliceClick ? { cursor: "pointer" } : undefined}
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0];
              return (
                <div className="rounded-lg border border-border-strong bg-elevated px-3 py-2 text-xs shadow-xl">
                  <span className="text-text-primary font-semibold">{p.name}</span>:{" "}
                  <span className="tabular-nums">{p.value}</span>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-xl font-bold text-text-primary">{centerLabel.value}</div>
          <div className="text-[0.65rem] text-text-muted">{centerLabel.sub}</div>
        </div>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
        {data.map((d) =>
          onSliceClick ? (
            <button
              key={d.name}
              onClick={() => onSliceClick(d.name)}
              className="flex items-center gap-1.5 text-[0.7rem] text-text-secondary hover:text-text-primary transition-colors"
            >
              <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
              {d.name}
            </button>
          ) : (
            <div key={d.name} className="flex items-center gap-1.5 text-[0.7rem] text-text-secondary">
              <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
              {d.name}
            </div>
          )
        )}
      </div>
    </div>
  );
}
