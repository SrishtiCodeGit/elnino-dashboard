"use client";

import { useMemo } from "react";
import { riskColor } from "@/lib/theme";
import { DonutChart } from "@/components/charts/DonutChart";
import type { TopRiskItem } from "@/lib/dataUtils";

export function TopRisksModal({
  items,
  onSelect,
  onClose,
}: {
  items: TopRiskItem[];
  onSelect: (abbr: string) => void;
  onClose: () => void;
}) {
  const chartData = useMemo(
    () => items.map((item) => ({ name: item.state, value: item.score, color: riskColor(item.score) })),
    [items]
  );
  const abbrByState = useMemo(() => new Map(items.map((item) => [item.state, item.abbr])), [items]);
  const avgScore = items.length
    ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length)
    : 0;

  function selectState(name: string) {
    const abbr = abbrByState.get(name);
    if (abbr) {
      onSelect(abbr);
      onClose();
    }
  }

  return (
    <div className="light-cards fixed inset-0 z-40 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-fade" onClick={onClose} />

      <div className="modal-pop relative w-full max-w-2xl max-h-[80vh] rounded-xl border border-border-strong bg-elevated shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-text-primary">Today&rsquo;s Top Risks</h2>
            <p className="text-[0.78rem] text-text-secondary mt-0.5">
              States ranked by financial risk score. Click a slice or a state for full detail.
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

        <div className="overflow-y-auto px-6 py-5">
          <DonutChart
            data={chartData}
            height={280}
            centerLabel={{ value: String(avgScore), sub: "avg score" }}
            onSliceClick={selectState}
            light
            animate
          />

          <div className="mt-5 flex flex-col divide-y divide-border border-t border-border">
            {items.map((item, i) => (
              <button
                key={item.abbr}
                onClick={() => selectState(item.state)}
                className="flex items-start gap-3 py-3 text-left hover:bg-black/[0.03] transition-colors"
              >
                <span className="text-[0.72rem] font-mono text-text-muted mt-0.5 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                  style={{ background: riskColor(item.score) }}
                />
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline gap-2">
                    <span className="text-[0.85rem] font-semibold text-text-primary">{item.state}</span>
                    <span
                      className="text-[0.78rem] font-mono font-bold tabular-nums"
                      style={{ color: riskColor(item.score) }}
                    >
                      {item.score}
                    </span>
                  </span>
                  <span className="block text-[0.74rem] text-text-secondary leading-snug mt-0.5">
                    {item.climateNote}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
