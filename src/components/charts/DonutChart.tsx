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
}: {
  data: Datum[];
  height?: number;
  centerLabel?: { value: string; sub: string };
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
            stroke={COLOR.surface}
            strokeWidth={2}
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
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
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5 text-[0.7rem] text-text-secondary">
            <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
            {d.name}
          </div>
        ))}
      </div>
    </div>
  );
}
