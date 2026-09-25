"use client";

import { useEffect } from "react";
import { WeatherWidget } from "@/components/WeatherWidget";
import { AiSummaryWidget } from "@/components/AiSummaryWidget";
import { CountUpNumber } from "@/components/CountUpNumber";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { riskColor, COMMODITY_COLOR, COLOR } from "@/lib/theme";
import { FUTURES_KEY_TO_NAME, getTrackedCommodityKeys, scoreBreakdown } from "@/lib/dataUtils";
import type { StateImpact, CommodityRecord, ElNinoEvent, BondRecord } from "@/lib/dataUtils";
import type { StateRef } from "@/lib/states";

const ANOMALY_LABEL: Record<string, string> = {
  above_normal: "Above Normal",
  below_normal: "Below Normal",
  near_normal: "Near Normal",
  mixed: "Mixed / Inconsistent",
};

// Darker than the data-viz palette in theme.ts — these render as small text
// badges on a light card and need real contrast against white, not just
// enough to pop against a dark map.
const EXPOSURE_COLOR: Record<string, string> = {
  high: "#DC2626",
  medium: "#B45309",
  low: "#047857",
  none: "#64748B",
};

function ExposurePill({ label, level }: { label: string; level: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-elevated px-3.5 py-2.5">
      <span className="text-xs text-text-secondary">{label}</span>
      <span
        className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded"
        style={{ color: EXPOSURE_COLOR[level] ?? COLOR.textMuted, background: "rgba(15,23,42,0.06)" }}
      >
        {level}
      </span>
    </div>
  );
}

export function StatePanel({
  stateRef,
  impact,
  commodities,
  elNinoEvents,
  bonds,
  onClose,
}: {
  stateRef: StateRef;
  impact: StateImpact | null;
  commodities: CommodityRecord[];
  elNinoEvents: ElNinoEvent[];
  bonds: BondRecord[];
  onClose: () => void;
}) {
  const trackedCommodityKeys = getTrackedCommodityKeys(impact);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-fade" onClick={onClose} />
      <div className="slide-in-right fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] lg:w-[520px] bg-bg border-l border-border-strong shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 px-6 pt-6 pb-4 bg-bg border-b border-border">
          <div className="dark-on-bg">
            <h2 className="text-xl font-bold tracking-tight text-text-primary">{stateRef.name}</h2>
            <p className="text-[0.8rem] text-text-secondary mt-0.5">
              {impact?.region ?? "Region data pending"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 shrink-0 rounded-full border border-border-strong bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="5" x2="19" y2="19" />
              <line x1="19" y1="5" x2="5" y2="19" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {impact && (
            <div className="rounded-xl border border-border bg-surface px-5 py-3 flex items-center justify-between">
              <span className="text-[0.68rem] font-semibold uppercase tracking-widest text-text-muted">
                Financial Risk Score
              </span>
              <span
                className="text-2xl font-extrabold font-mono tabular-nums"
                style={{ color: riskColor(impact.financialRiskScore) }}
              >
                <CountUpNumber value={impact.financialRiskScore} />
                <span className="text-sm text-text-muted">/100</span>
              </span>
            </div>
          )}

          {impact?.live && (
            <div className="rounded-xl border border-border bg-surface px-5 py-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[0.68rem] font-semibold uppercase tracking-widest text-text-muted">
                  Live Conditions
                </span>
                <span className="text-xs font-mono tabular-nums text-text-secondary">
                  {impact.live.baselineScore} baseline{" "}
                  <span className="font-bold" style={{ color: impact.live.adjustment > 0 ? "#DC2626" : undefined }}>
                    +{impact.live.adjustment} live
                  </span>
                </span>
              </div>
              {impact.live.alerts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {impact.live.alerts.map((a) => (
                    <span
                      key={a.event}
                      className="text-[0.68rem] px-2 py-1 rounded border"
                      style={{
                        color: a.severity === "Extreme" ? "#B91C1C" : "#B45309",
                        borderColor: a.severity === "Extreme" ? "#FCA5A5" : "#FCD34D",
                      }}
                    >
                      {a.event}
                    </span>
                  ))}
                </div>
              )}
              {impact.live.droughtD2Plus != null && (
                <p className="text-[0.72rem] text-text-secondary">
                  {impact.live.droughtD2Plus.toFixed(0)}% of the state in severe drought or worse
                  {impact.live.droughtWeekOf ? ` (week of ${impact.live.droughtWeekOf})` : ""}
                  {impact.live.droughtPoints > 0 ? `, +${impact.live.droughtPoints}` : ""}
                </p>
              )}
              {impact.live.alerts.length === 0 && impact.live.adjustment === 0 && (
                <p className="text-[0.72rem] text-text-secondary">
                  {impact.live.droughtD2Plus == null
                    ? "No severe weather warnings right now. Drought data is temporarily unavailable."
                    : "No severe weather warnings or drought stress right now."}
                </p>
              )}
            </div>
          )}

          {impact && (() => {
            const rows = scoreBreakdown(impact);
            if (!rows) return null;
            const baseline = impact.live?.baselineScore ?? impact.financialRiskScore;
            return (
              <div className="rounded-xl border border-border bg-surface px-5 py-3.5 flex flex-col gap-1.5">
                <div className="text-[0.68rem] font-semibold uppercase tracking-widest text-text-muted mb-1">
                  How this score is built
                </div>
                {rows.map((r) => (
                  <div key={r.label} className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="text-text-secondary">
                      {r.label} <span className="text-text-muted">({Math.round(r.weight * 100)}%)</span>
                    </span>
                    <span className="font-mono tabular-nums text-text-secondary whitespace-nowrap">
                      <span className="uppercase text-text-muted mr-2">{r.input}</span>
                      <span className="font-bold text-text-primary">{r.points.toFixed(1)}</span>
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border pt-1.5 mt-0.5 text-xs">
                  <span className="font-semibold text-text-primary">Baseline score</span>
                  <span className="font-mono font-bold tabular-nums text-text-primary">{baseline}</span>
                </div>
              </div>
            );
          })()}

          <WeatherWidget abbr={stateRef.abbr} />

          {impact ? (
            <>
              <AiSummaryWidget abbr={stateRef.abbr} />

              <div className="rounded-xl border border-border bg-surface px-5 py-4">
                <div className="text-[0.7rem] font-semibold tracking-wider uppercase text-text-muted mb-2">
                  El Nino Climate Pattern
                </div>
                <div className="flex gap-2 mb-2.5 flex-wrap">
                  <span className="text-[0.68rem] px-2 py-1 rounded bg-elevated border border-border text-text-secondary">
                    Temp: {ANOMALY_LABEL[impact.ensoTempAnomaly]}
                  </span>
                  <span className="text-[0.68rem] px-2 py-1 rounded bg-elevated border border-border text-text-secondary">
                    Precip: {ANOMALY_LABEL[impact.ensoPrecipAnomaly]}
                  </span>
                </div>
                <p className="text-[0.78rem] text-text-secondary leading-relaxed">{impact.climateNote}</p>
              </div>

              <div className="rounded-xl border border-border bg-surface px-5 py-4 flex flex-col gap-2">
                <div className="text-[0.7rem] font-semibold tracking-wider uppercase text-text-muted mb-1">
                  Economic Exposure
                </div>
                <ExposurePill label="Commodity Exposure" level={impact.commodityExposure} />
                <ExposurePill label="Energy Exposure" level={impact.energyExposure} />
                {impact.agGdpShare != null && (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-elevated px-3.5 py-2.5">
                    <span className="text-xs text-text-secondary">Agriculture Share of GDP</span>
                    <span className="text-xs font-bold text-text-primary tabular-nums">
                      {impact.agGdpShare.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>

              {impact.keyCommodities.length > 0 && (
                <div>
                  <div className="dark-on-bg text-[0.7rem] font-semibold tracking-wider uppercase text-text-muted mb-2">
                    Key Commodities &amp; Industries
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {impact.keyCommodities.map((c) => (
                      <span
                        key={c}
                        className="text-xs px-3 py-1.5 rounded-full border border-border bg-elevated text-text-secondary"
                      >
                        {c}
                        {!trackedCommodityKeys.some((k) => FUTURES_KEY_TO_NAME[k] === c) && (
                          <span className="text-text-muted"> (no futures tracked)</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {trackedCommodityKeys.length > 0 && (
                <div className="flex flex-col gap-4">
                  <div className="dark-on-bg text-[0.7rem] font-semibold tracking-wider uppercase text-text-muted -mb-1">
                    Related Commodity Markets &middot; Shaded = El Nino Windows
                  </div>
                  {trackedCommodityKeys.map((key) => {
                    const name = FUTURES_KEY_TO_NAME[key];
                    const color = COMMODITY_COLOR[name] ?? COLOR.laNinaStrong;
                    return (
                      <div key={key} className="rounded-xl border border-border bg-surface p-4">
                        <div className="text-xs font-semibold text-text-secondary mb-1">{name} Futures</div>
                        <TimeSeriesChart
                          data={commodities.map((c) => ({ date: c.date, [key]: c[key as keyof CommodityRecord] }))}
                          series={[{ key, name, color, type: "area" }]}
                          elNinoEvents={elNinoEvents}
                          height={160}
                          valueFormatter={(v) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 1 })}`}
                          light
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="text-xs font-semibold text-text-secondary mb-1">
                  10-Year Treasury Yield &middot; Broader Rate Environment
                </div>
                <TimeSeriesChart
                  data={bonds.map((b) => ({ date: b.date, DGS10: b.DGS10 }))}
                  series={[{ key: "DGS10", name: "10-Year Yield", color: COLOR.violet }]}
                  elNinoEvents={elNinoEvents}
                  height={160}
                  valueFormatter={(v) => `${v.toFixed(2)}%`}
                  light
                />
              </div>

              <div className="dark-on-bg">
                <div className="text-[0.7rem] font-semibold tracking-wider uppercase text-text-muted mb-1.5">
                  Sources
                </div>
                <div className="text-[0.72rem] text-text-secondary leading-relaxed">
                  {impact.sources.map((s) => (
                    <div key={s}>&middot; {s}</div>
                  ))}
                </div>
                <p className="text-[0.66rem] text-text-muted mt-2">
                  Financial Risk Score is a research-project composite — not an official
                  government index.
                </p>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-border bg-surface px-5 py-8 text-center text-sm text-text-muted">
              State impact dataset not yet available for {stateRef.name}.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
