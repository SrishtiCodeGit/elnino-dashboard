"use client";

import { riskColor } from "@/lib/theme";
import { severityLabel } from "@/lib/dataUtils";
import type { TopRiskItem } from "@/lib/dataUtils";

/** A continuously-scrolling strip of the real top-risk states (same ranked
 * list as "Today's Top Risks"), always visible on the landing view instead
 * of gated behind a click — gives the dashboard something real to look at
 * immediately. The item list is duplicated once so the CSS marquee loop is
 * seamless; clicking an item behaves like clicking it anywhere else in the
 * app (opens that state's detail panel). */
export function RiskTicker({
  items,
  onSelect,
}: {
  items: TopRiskItem[];
  onSelect: (abbr: string) => void;
}) {
  if (items.length === 0) return null;
  const loop = [...items, ...items];

  return (
    <div className="light-cards w-full border-b border-border-strong bg-surface/80 backdrop-blur overflow-hidden">
      <div className="ticker-track flex items-stretch">
        {loop.map((item, i) => {
          const color = riskColor(item.score);
          return (
            <button
              key={`${item.abbr}-${i}`}
              onClick={() => onSelect(item.abbr)}
              className="flex items-center gap-2 shrink-0 px-4 py-1.5 border-r border-border hover:bg-black/[0.03] transition-colors"
            >
              <span
                className="text-[0.68rem] font-mono font-extrabold tabular-nums px-1.5 py-0.5 rounded"
                style={{ color, background: `${color}1a` }}
              >
                {item.score}
              </span>
              <span className="text-[0.72rem] font-semibold text-text-primary whitespace-nowrap">
                {item.state}
              </span>
              <span className="text-[0.66rem] text-text-muted whitespace-nowrap">{severityLabel(item.score)}</span>
              <span className="text-[0.66rem] text-text-secondary whitespace-nowrap max-w-xs truncate">
                {item.climateNote}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
