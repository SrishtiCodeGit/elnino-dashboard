"use client";

import { useMemo } from "react";
import { riskColor } from "@/lib/theme";
import { flowRiskInfo } from "@/lib/dataUtils";
import { STATE_BY_ABBR } from "@/lib/states";
import type { StateImpact, SupplyChainFlow } from "@/lib/dataUtils";

function stateName(abbr: string): string {
  return STATE_BY_ABBR[abbr]?.name ?? abbr;
}

function formatValue(v: number): string {
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}B` : `$${Math.round(v)}M`;
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="text-[0.6rem] font-mono font-semibold uppercase tracking-widest text-text-muted">{label}</div>
      <div className="text-[1.1rem] font-bold text-text-primary tabular-nums mt-0.5">{value}</div>
      <div className="text-[0.64rem] text-text-secondary mt-0.5">{sub}</div>
    </div>
  );
}

/** Origin -> Destination as two small state chips joined by an arrow —
 * reads as a route at a glance instead of a text cell. Origin carries the
 * real risk color (that's whose score the whole row is tagged with);
 * destination stays neutral. */
function RoutePath({ origin, destination, color }: { origin: string; destination: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span
        className="w-8 h-8 rounded-full flex items-center justify-center text-[0.62rem] font-mono font-bold text-white shrink-0"
        style={{ background: color }}
        title={stateName(origin)}
      >
        {origin}
      </span>
      <svg width="20" height="10" viewBox="0 0 20 10" className="text-text-muted shrink-0">
        <line x1="0" y1="5" x2="15" y2="5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M13 1 L18 5 L13 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span
        className="w-8 h-8 rounded-full flex items-center justify-center text-[0.62rem] font-mono font-bold text-text-secondary bg-black/[0.06] shrink-0"
        title={stateName(destination)}
      >
        {destination}
      </span>
    </div>
  );
}

/** Top routes by real dollar value, as an actual bar chart — the diagram
 * that answers "what are the biggest flows" before the browsable card grid
 * answers "what about every route". */
function TopRoutesChart({ rows }: { rows: { flow: SupplyChainFlow; info: ReturnType<typeof flowRiskInfo> }[] }) {
  const top = rows.slice(0, 8);
  const maxValue = Math.max(1, ...top.map((r) => r.flow.valueUsdMillions));
  return (
    <div className="flex flex-col gap-2">
      {top.map((r) => {
        const color = riskColor(r.info.score ?? 0);
        const widthPct = Math.max(4, (r.flow.valueUsdMillions / maxValue) * 100);
        return (
          <div key={`${r.flow.origin}-${r.flow.destination}-${r.flow.commodityCode}`} className="flex items-center gap-2.5">
            <RoutePath origin={r.flow.origin} destination={r.flow.destination} color={color} />
            <div className="flex-1 min-w-0">
              <div className="text-[0.66rem] text-text-secondary truncate mb-0.5">{r.flow.commodityName}</div>
              <div className="h-3.5 bg-black/[0.04] rounded overflow-hidden">
                <div className="h-full rounded" style={{ width: `${widthPct}%`, background: color }} />
              </div>
            </div>
            <span className="w-16 shrink-0 text-right text-[0.72rem] font-mono font-bold tabular-nums" style={{ color }}>
              {formatValue(r.flow.valueUsdMillions)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FlowCard({
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
    <button
      onClick={() => {
        onSelect(flow.origin);
        onClose();
      }}
      className="text-left rounded-lg border border-border bg-surface hover:border-la-nina-deep hover:bg-black/[0.02] transition-colors p-3 flex flex-col gap-2"
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      <div className="flex items-center justify-between gap-2">
        <RoutePath origin={flow.origin} destination={flow.destination} color={color} />
        {score != null && (
          <span className="text-[0.62rem] font-mono font-bold px-1.5 py-0.5 rounded shrink-0" style={{ color, background: `${color}1A` }}>
            {score}
          </span>
        )}
      </div>
      <div>
        <div className="text-[0.76rem] font-semibold text-text-primary">{flow.commodityName}</div>
        <div className="text-[0.68rem] text-text-secondary">
          {stateName(flow.origin)} &rarr; {stateName(flow.destination)}
        </div>
      </div>
      <div className="text-[0.9rem] font-mono font-bold tabular-nums" style={{ color }}>
        {formatValue(flow.valueUsdMillions)}
      </div>
      {climateNote && <p className="text-[0.66rem] text-text-secondary leading-snug line-clamp-2">{climateNote}</p>}
    </button>
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
  const rows = useMemo(
    () =>
      flows
        .map((flow) => ({ flow, info: flowRiskInfo(flow, statesByAbbr) }))
        .sort((a, b) => (b.info.score ?? 0) - (a.info.score ?? 0)),
    [flows, statesByAbbr]
  );

  const affected = rows.filter((r) => r.info.severity === "High" || r.info.severity === "Severe");
  const stable = rows.filter((r) => r.info.severity === "Low" || r.info.severity === "Moderate");
  const totalValue = rows.reduce((sum, r) => sum + r.flow.valueUsdMillions, 0);

  return (
    <div className="light-cards fixed inset-0 z-40 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-fade" onClick={onClose} />

      <div className="modal-pop relative w-full max-w-4xl max-h-[85vh] rounded-xl border border-border-strong bg-elevated shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-text-primary">Supply Chain Risk Report</h2>
            <p className="text-[0.78rem] text-text-secondary mt-0.5 max-w-lg">
              The {flows.length} highest-value real interstate commodity flows (BTS Freight Analysis Framework,
              2022), tagged by the origin state&rsquo;s own financial risk score.
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

        <div className="overflow-y-auto px-6 py-5 flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-2">
            <Kpi label="Total Flow Value" value={formatValue(totalValue)} sub={`${rows.length} routes`} />
            <Kpi label="Affected Routes" value={String(affected.length)} sub="Origin risk High/Severe" />
            <Kpi label="Stable Routes" value={String(stable.length)} sub="Origin risk Low/Moderate" />
          </div>

          <div>
            <div className="text-[0.76rem] font-semibold text-text-primary mb-2.5">Biggest Routes by Real Value</div>
            <TopRoutesChart rows={rows} />
          </div>

          {affected.length > 0 && (
            <div>
              <div className="text-[0.7rem] font-mono font-semibold uppercase tracking-widest text-el-nino-deep mb-2">
                Affected Routes &middot; origin state risk High / Severe
              </div>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {affected.map((r) => (
                  <FlowCard
                    key={`${r.flow.origin}-${r.flow.destination}-${r.flow.commodityCode}`}
                    flow={r.flow}
                    score={r.info.score}
                    color={riskColor(r.info.score ?? 0)}
                    climateNote={r.info.climateNote}
                    onSelect={onSelect}
                    onClose={onClose}
                  />
                ))}
              </div>
            </div>
          )}

          {stable.length > 0 && (
            <div>
              <div className="text-[0.7rem] font-mono font-semibold uppercase tracking-widest text-text-muted mb-2">
                Stable Routes &middot; origin state risk Low / Moderate
              </div>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {stable.map((r) => (
                  <FlowCard
                    key={`${r.flow.origin}-${r.flow.destination}-${r.flow.commodityCode}`}
                    flow={r.flow}
                    score={r.info.score}
                    color={riskColor(r.info.score ?? 0)}
                    climateNote={r.info.climateNote}
                    onSelect={onSelect}
                    onClose={onClose}
                  />
                ))}
              </div>
            </div>
          )}

          <p className="text-[0.68rem] text-text-muted leading-relaxed border-t border-border pt-3">
            Flow values are real BTS/ORNL Freight Analysis Framework data, not fabricated &mdash; see{" "}
            <span className="font-mono">data/supply_chain_flows_README.md</span> for full sourcing and known
            limitations. Risk tags reuse each origin state&rsquo;s existing Financial Risk Score; this is not a
            forecast of which routes will actually be disrupted.
          </p>
        </div>
      </div>
    </div>
  );
}
