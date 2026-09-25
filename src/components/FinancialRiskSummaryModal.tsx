"use client";

import { useMemo } from "react";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { PHASE_COLOR, COLOR } from "@/lib/theme";
import type { FinancialRecord, ElNinoEvent, PhaseReturn, BacktestResults } from "@/lib/dataUtils";

function formatIndex(v: number) {
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="text-[0.6rem] font-mono font-semibold uppercase tracking-widest text-text-muted">{label}</div>
      <div className="text-[1.15rem] font-bold text-text-primary tabular-nums mt-0.5">{value}</div>
      <div className="text-[0.66rem] text-text-secondary mt-0.5">{sub}</div>
    </div>
  );
}

function BacktestSection({ b }: { b: BacktestResults }) {
  const { temp, pcp } = b.directionTest;
  const sigMarket = b.marketTest.filter((m) => m.qFdr < b.meta.fdrQ).length;
  const minQ = Math.min(...b.marketTest.map((m) => m.qFdr));
  const episodes = b.marketTest.map((m) => m.elNinoEpisodes);
  const misses = b.precipMismatches.map((m) => m.abbr).join(", ");

  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-4 flex flex-col gap-3">
      <div>
        <div className="text-[0.7rem] font-semibold tracking-wider uppercase text-text-muted">
          Does history back the model?
        </div>
        <p className="text-[0.72rem] text-text-secondary mt-1">
          Backtest against {b.meta.winters} winters of NOAA state climate data ({b.meta.elNinoWinters} El Nino winters)
          and 7 market series chosen in advance. Multiple-testing corrected (FDR).
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-elevated px-3 py-2.5">
          <div className="text-[0.6rem] font-mono font-semibold uppercase tracking-widest text-text-muted">Temperature labels</div>
          <div className="text-[1.05rem] font-bold text-text-primary tabular-nums mt-0.5">
            {temp.signMatches}/{temp.directionalLabels}
          </div>
          <div className="text-[0.66rem] text-text-secondary">right direction</div>
        </div>
        <div className="rounded-lg border border-border bg-elevated px-3 py-2.5">
          <div className="text-[0.6rem] font-mono font-semibold uppercase tracking-widest text-text-muted">Precipitation labels</div>
          <div className="text-[1.05rem] font-bold text-text-primary tabular-nums mt-0.5">
            {pcp.signMatches}/{pcp.directionalLabels}
          </div>
          <div className="text-[0.66rem] text-text-secondary">right direction</div>
        </div>
        <div className="rounded-lg border border-border bg-elevated px-3 py-2.5">
          <div className="text-[0.6rem] font-mono font-semibold uppercase tracking-widest text-text-muted">Signal strength rank</div>
          <div className="text-[1.05rem] font-bold text-text-primary tabular-nums mt-0.5">
            &rho; = {b.strengthTest.spearmanRho.toFixed(2)}
          </div>
          <div className="text-[0.66rem] text-text-secondary">vs measured, {b.strengthTest.n} states</div>
        </div>
      </div>

      <p className="text-[0.74rem] text-text-secondary leading-relaxed">
        <strong className="text-text-primary">Climate side holds up.</strong> Where the model says El Nino makes a state
        warmer/cooler or wetter/drier, history agrees far more often than chance. Weak spot: history doesn&rsquo;t support the
        precipitation labels for {misses}.
      </p>
      <p className="text-[0.74rem] text-text-secondary leading-relaxed">
        <strong className="text-text-primary">Market side is not proven.</strong>{" "}
        {sigMarket === 0
          ? `None of the 7 market series shows a statistically significant El Nino effect (smallest FDR q = ${minQ.toFixed(2)}).`
          : `${sigMarket} of 7 market series clears the significance bar.`}{" "}
        With only {Math.min(...episodes)}&ndash;{Math.max(...episodes)} independent El Nino episodes the test has little
        power, so this means &ldquo;not detected&rdquo;, not &ldquo;no effect&rdquo;.
      </p>
    </div>
  );
}

function PhaseReturnBars({ title, returns, sourceNote }: { title: string; returns: PhaseReturn[]; sourceNote: string }) {
  const maxAbs = Math.max(0.5, ...returns.map((r) => Math.abs(r.mean)));
  return (
    <div>
      <div className="text-[0.76rem] font-semibold text-text-primary mb-2">{title}</div>
      <div className="flex flex-col gap-1.5">
        {returns.map((r) => {
          const widthPct = Math.min(100, (Math.abs(r.mean) / maxAbs) * 100);
          const positive = r.mean >= 0;
          return (
            <div key={r.phase} className="flex items-center gap-2">
              <span className="w-[5.5rem] shrink-0 text-[0.66rem] text-text-secondary truncate">{r.phase}</span>
              <div className="flex-1 h-4 bg-black/[0.04] rounded overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{ width: `${widthPct}%`, background: PHASE_COLOR[r.phase] ?? COLOR.neutral }}
                />
              </div>
              <span
                className="w-12 shrink-0 text-[0.68rem] font-mono font-semibold text-right tabular-nums"
                style={{ color: positive ? "#16A34A" : "#DC2626" }}
              >
                {positive ? "+" : ""}
                {r.mean.toFixed(1)}%
              </span>
              <span className="w-14 shrink-0 text-[0.6rem] text-text-muted text-right">n={r.count}</span>
            </div>
          );
        })}
      </div>
      <p className="text-[0.6rem] text-text-muted mt-1.5 leading-snug">{sourceNote}</p>
    </div>
  );
}

/** "See Details" summary for the Financial Risk view — connects state-level
 * climate risk to real market behavior: the actual S&P 500 series over
 * ENSO windows, plus average quarterly returns by ENSO phase for the broad
 * market and the two sectors most directly exposed to the same climate
 * signal (Insurance, Agriculture). All numbers are real (Yahoo Finance
 * daily closes vs. NOAA ONI phase classification) — nothing here is
 * invented or a forecast. */
export function FinancialRiskSummaryModal({
  financialMarkets,
  elNinoEvents,
  spReturns,
  insuranceReturns,
  agricultureReturns,
  backtest,
  onClose,
}: {
  financialMarkets: FinancialRecord[];
  elNinoEvents: ElNinoEvent[];
  spReturns: PhaseReturn[];
  insuranceReturns: PhaseReturn[];
  agricultureReturns: PhaseReturn[];
  backtest: BacktestResults | null;
  onClose: () => void;
}) {
  const latest = financialMarkets[financialMarkets.length - 1];
  const chartData = useMemo(
    () => financialMarkets.map((r) => ({ date: r.date, SP500: r.SP500 })),
    [financialMarkets]
  );

  return (
    <div className="light-cards fixed inset-0 z-40 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-fade" onClick={onClose} />

      <div className="modal-pop relative w-full max-w-2xl max-h-[85vh] rounded-xl border border-border-strong bg-elevated shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-text-primary">Financial Risk — Market Impact</h2>
            <p className="text-[0.78rem] text-text-secondary mt-0.5">
              How real markets have historically moved across ENSO climate phases.
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
            <Kpi label="S&P 500" value={latest?.SP500 != null ? formatIndex(latest.SP500) : "—"} sub="Broad market" />
            <Kpi label="VIX" value={latest?.VIX != null ? latest.VIX.toFixed(1) : "—"} sub="Volatility / fear" />
            <Kpi
              label="Insurance ETF"
              value={latest?.Insurance_ETF != null ? `$${latest.Insurance_ETF.toFixed(2)}` : "—"}
              sub="Climate/disaster-linked"
            />
          </div>

          <div>
            <div className="text-[0.76rem] font-semibold text-text-primary mb-2">S&amp;P 500 Through El Nino Events</div>
            <TimeSeriesChart
              data={chartData}
              series={[{ key: "SP500", name: "S&P 500", color: "#0EA5E9" }]}
              elNinoEvents={elNinoEvents}
              height={200}
              yLabel="Index"
              valueFormatter={formatIndex}
              light
            />
          </div>

          <div className="flex flex-col gap-4">
            <PhaseReturnBars
              title="S&P 500 — Avg Quarterly Return by ENSO Phase"
              returns={spReturns}
              sourceNote="Yahoo Finance ^GSPC vs NOAA ONI"
            />
            <PhaseReturnBars
              title="Insurance Sector — Avg Quarterly Return by ENSO Phase"
              returns={insuranceReturns}
              sourceNote="Insurance ETF vs NOAA ONI"
            />
            <PhaseReturnBars
              title="Agriculture Sector — Avg Quarterly Return by ENSO Phase"
              returns={agricultureReturns}
              sourceNote="Agriculture ETF vs NOAA ONI"
            />
          </div>

          {backtest && <BacktestSection b={backtest} />}

          <p className="text-[0.68rem] text-text-muted leading-relaxed border-t border-border pt-3">
            Average quarterly % change grouped by that quarter&rsquo;s ENSO phase, 1990&ndash;present. Real historical
            correlation, not a forecast or investment recommendation &mdash; state-level financial risk scores on this
            map are a separate research composite and are not derived from these market series.
          </p>

          <a
            href="/markets"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[0.76rem] font-semibold text-la-nina-deep hover:underline self-start"
          >
            Open full Financial Markets page &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
