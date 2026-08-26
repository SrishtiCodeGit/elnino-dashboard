"use client";

import { riskColor } from "@/lib/theme";
import { severityLabel } from "@/lib/dataUtils";
import { STATE_BY_ABBR } from "@/lib/states";
import type { StateImpact, SupplyChainFlow } from "@/lib/dataUtils";

export function SupplyChainBuildingDetail({
  abbr,
  impact,
  flows,
  onClose,
}: {
  abbr: string;
  impact: StateImpact | undefined;
  flows: SupplyChainFlow[];
  onClose: () => void;
}) {
  const stateName = STATE_BY_ABBR[abbr]?.name ?? abbr;
  const related = flows.filter((f) => f.origin === abbr || f.destination === abbr);
  const totalValue = related.reduce((sum, f) => sum + f.valueUsdMillions, 0);
  const score = impact?.financialRiskScore ?? null;
  const color = score != null ? riskColor(score) : "#94a3b8";

  return (
    <div className="light-cards fixed inset-0 z-40 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-fade" onClick={onClose} />

      <div className="modal-pop relative w-full max-w-lg max-h-[85vh] rounded-xl border border-border-strong bg-elevated shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border">
          <div>
            <div className="text-[0.62rem] font-mono font-semibold uppercase tracking-widest text-text-muted mb-1">
              Supply Chain Impact
            </div>
            <h2 className="text-lg font-bold tracking-tight text-text-primary">{stateName}</h2>
            <p className="text-[0.78rem] text-text-secondary mt-0.5">{impact?.region ?? ""}</p>
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

        <div className="overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-surface px-4 py-3">
              <div className="text-[0.62rem] font-mono uppercase tracking-widest text-text-muted mb-1">
                Total Flow Value
              </div>
              <div className="text-xl font-extrabold font-mono tabular-nums text-text-primary">
                ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}M
              </div>
              <div className="text-[0.66rem] text-text-muted mt-0.5">
                across {related.length} route{related.length === 1 ? "" : "s"}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface px-4 py-3">
              <div className="text-[0.62rem] font-mono uppercase tracking-widest text-text-muted mb-1">
                Financial Risk Score
              </div>
              <div className="text-xl font-extrabold font-mono tabular-nums" style={{ color }}>
                {score ?? "—"}
                <span className="text-xs text-text-muted">/100</span>
              </div>
              {score != null && (
                <div className="text-[0.66rem] font-semibold uppercase tracking-wide mt-0.5" style={{ color }}>
                  {severityLabel(score)}
                </div>
              )}
            </div>
          </div>

          {impact?.climateNote && (
            <div className="rounded-lg border-l-[3px] px-4 py-3 bg-elevated" style={{ borderLeftColor: color }}>
              <div className="text-[0.62rem] font-mono font-semibold uppercase tracking-widest mb-1" style={{ color }}>
                Why This Is Affected
              </div>
              <p className="text-[0.8rem] text-text-secondary leading-relaxed">{impact.climateNote}</p>
            </div>
          )}

          <div>
            <div className="text-[0.62rem] font-mono font-semibold uppercase tracking-widest text-text-muted mb-2">
              Routes Through {stateName}
            </div>
            <div className="flex flex-col gap-1.5">
              {related.map((f) => {
                const isOrigin = f.origin === abbr;
                const otherAbbr = isOrigin ? f.destination : f.origin;
                const otherName = STATE_BY_ABBR[otherAbbr]?.name ?? otherAbbr;
                return (
                  <div
                    key={`${f.origin}-${f.destination}-${f.commodityCode}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-[0.76rem] font-semibold text-text-primary truncate">
                        {f.commodityName}
                      </div>
                      <div className="text-[0.68rem] text-text-muted truncate">
                        {isOrigin ? `Shipped to ${otherName}` : `Received from ${otherName}`}
                      </div>
                    </div>
                    <div className="text-[0.76rem] font-mono font-bold tabular-nums text-text-primary shrink-0">
                      ${f.valueUsdMillions.toLocaleString(undefined, { maximumFractionDigits: 0 })}M
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[0.66rem] text-text-muted leading-relaxed pt-2 border-t border-border">
            Flow values are real BTS Freight Analysis Framework data. Risk score and climate reasoning are this
            state&rsquo;s own research-composite figures — the same ones shown elsewhere in this dashboard, not a
            separate model.
          </p>
        </div>
      </div>
    </div>
  );
}
