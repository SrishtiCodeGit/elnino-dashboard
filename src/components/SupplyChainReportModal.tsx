"use client";

import { riskColor } from "@/lib/theme";
import { flowRiskInfo } from "@/lib/dataUtils";
import { STATE_BY_ABBR } from "@/lib/states";
import type { StateImpact, SupplyChainFlow } from "@/lib/dataUtils";

function stateName(abbr: string): string {
  return STATE_BY_ABBR[abbr]?.name ?? abbr;
}

function FlowRow({
  flow,
  score,
  color,
  climateNote,
  onSelect,
  onClose,
}: {
  flow: SupplyChainFlow;
  score: number | null;
  color: string;
  climateNote: string | null;
  onSelect: (abbr: string) => void;
  onClose: () => void;
}) {
  return (
    <tr
      onClick={() => {
        onSelect(flow.origin);
        onClose();
      }}
      className="cursor-pointer border-t border-border hover:bg-black/[0.03] transition-colors"
    >
      <td className="px-6 py-3 align-top">
        <span className="text-[0.72rem] font-semibold text-text-primary">{flow.commodityName}</span>
      </td>
      <td className="px-2 py-3 align-top">
        <div className="text-[0.82rem] font-semibold text-text-primary">
          {stateName(flow.origin)} <span className="text-text-muted">&rarr;</span> {stateName(flow.destination)}
        </div>
        {climateNote && (
          <div className="text-[0.68rem] text-text-secondary leading-snug mt-0.5 max-w-md">{climateNote}</div>
        )}
      </td>
      <td className="px-2 py-3 align-top text-right whitespace-nowrap">
        <span className="text-[0.78rem] font-mono font-bold tabular-nums" style={{ color }}>
          ${flow.valueUsdMillions.toLocaleString(undefined, { maximumFractionDigits: 0 })}M
        </span>
        {score != null && (
          <div className="text-[0.62rem] font-mono text-text-muted mt-0.5">Origin risk {score}/100</div>
        )}
      </td>
    </tr>
  );
}

export function SupplyChainReportModal({
  flows,
  statesByAbbr,
  onSelect,
  onClose,
}: {
  flows: SupplyChainFlow[];
  statesByAbbr: Record<string, StateImpact>;
  onSelect: (abbr: string) => void;
  onClose: () => void;
}) {
  const rows = flows
    .map((flow) => ({ flow, info: flowRiskInfo(flow, statesByAbbr) }))
    .sort((a, b) => (b.info.score ?? 0) - (a.info.score ?? 0));

  const affected = rows.filter((r) => r.info.severity === "High" || r.info.severity === "Severe");
  const stable = rows.filter((r) => r.info.severity === "Low" || r.info.severity === "Moderate");

  return (
    <div className="light-cards fixed inset-0 z-40 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-fade" onClick={onClose} />

      <div className="modal-pop relative w-full max-w-3xl max-h-[85vh] rounded-xl border border-border-strong bg-elevated shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-text-primary">Supply Chain Risk Report</h2>
            <p className="text-[0.78rem] text-text-secondary mt-0.5 max-w-lg">
              The {flows.length} highest-value real interstate commodity flows (BTS Freight Analysis Framework,
              2022), tagged by the origin state&rsquo;s own financial risk score &mdash; not a separate model.
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

        <div className="overflow-y-auto">
          {affected.length > 0 && (
            <>
              <div className="px-6 pt-4 pb-1 text-[0.7rem] font-mono font-semibold uppercase tracking-widest text-el-nino-deep">
                Affected Routes &middot; origin state risk High / Severe
              </div>
              <table className="w-full text-left border-collapse">
                <tbody>
                  {affected.map((r) => (
                    <FlowRow
                      key={`${r.flow.origin}-${r.flow.destination}-${r.flow.commodityCode}`}
                      flow={r.flow}
                      score={r.info.score}
                      color={riskColor(r.info.score ?? 0)}
                      climateNote={r.info.climateNote}
                      onSelect={onSelect}
                      onClose={onClose}
                    />
                  ))}
                </tbody>
              </table>
            </>
          )}

          {stable.length > 0 && (
            <>
              <div className="px-6 pt-4 pb-1 text-[0.7rem] font-mono font-semibold uppercase tracking-widest text-text-muted">
                Stable Routes &middot; origin state risk Low / Moderate
              </div>
              <table className="w-full text-left border-collapse">
                <tbody>
                  {stable.map((r) => (
                    <FlowRow
                      key={`${r.flow.origin}-${r.flow.destination}-${r.flow.commodityCode}`}
                      flow={r.flow}
                      score={r.info.score}
                      color={riskColor(r.info.score ?? 0)}
                      climateNote={r.info.climateNote}
                      onSelect={onSelect}
                      onClose={onClose}
                    />
                  ))}
                </tbody>
              </table>
            </>
          )}

          <p className="px-6 py-4 text-[0.68rem] text-text-muted leading-relaxed border-t border-border">
            Flow values are real BTS/ORNL Freight Analysis Framework data, not fabricated — see{" "}
            <span className="font-mono">data/supply_chain_flows_README.md</span> for full sourcing and known
            limitations. Risk tags reuse each origin state&rsquo;s existing Financial Risk Score; this is not a
            forecast of which routes will actually be disrupted.
          </p>
        </div>
      </div>
    </div>
  );
}
