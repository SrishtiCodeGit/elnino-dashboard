import { riskColor } from "@/lib/theme";
import type { NationalPulse } from "@/lib/dataUtils";

const TREND_STYLE: Record<NationalPulse["trend"], { glyph: string; color: string }> = {
  Strengthening: { glyph: "▲", color: "#DC2626" },
  Weakening: { glyph: "▼", color: "#047857" },
  Steady: { glyph: "—", color: "#64748B" },
};

const EXPOSURE_COLOR = "#B45309";

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.6rem] font-mono font-semibold uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <div className="text-[0.8rem] font-medium text-text-primary leading-snug">{children}</div>
    </div>
  );
}

export function NationalRiskPulse({ pulse, isLive }: { pulse: NationalPulse; isLive: boolean }) {
  const color = riskColor(pulse.index);
  const trend = TREND_STYLE[pulse.trend];

  return (
    <div className="hud-card pointer-events-none absolute top-4 left-20 w-72 rounded-lg border border-border-strong bg-elevated/90 backdrop-blur px-4 py-3 shadow-xl">
      <div className="text-[0.62rem] font-mono font-semibold uppercase tracking-widest text-text-muted mb-1.5">
        National Risk Pulse
      </div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-[1.9rem] font-mono font-extrabold leading-none tabular-nums" style={{ color }}>
          {pulse.index}
        </span>
        <span
          className="text-[0.68rem] font-mono font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
          style={{ color, background: "rgba(15,23,42,0.06)" }}
        >
          {pulse.severity}
        </span>
      </div>

      <div className="flex flex-col gap-2.5 pt-2.5 border-t border-border">
        <Row
          label={
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-green pulse-dot" : "bg-text-muted"}`}
              />
              ENSO Signal {isLive ? "· Live" : ""}
            </span>
          }
        >
          {pulse.oniPhase} &middot;{" "}
          <span className="font-mono tabular-nums">
            {pulse.oniValue >= 0 ? "+" : ""}
            {pulse.oniValue.toFixed(2)}&deg;C
          </span>{" "}
          &middot; <span style={{ color: trend.color, fontWeight: 700 }}>{trend.glyph} {pulse.trend}</span>
        </Row>

        <Row label="Primary Exposure">
          {pulse.primaryExposure.length ? (
            <span className="flex flex-wrap gap-1">
              {pulse.primaryExposure.map((name) => (
                <span
                  key={name}
                  className="px-1.5 py-0.5 rounded text-[0.72rem] font-semibold"
                  style={{ color: EXPOSURE_COLOR, background: "rgba(180,83,9,0.1)" }}
                >
                  {name}
                </span>
              ))}
            </span>
          ) : (
            "—"
          )}
        </Row>

        <Row label="Highest Exposure">
          {pulse.topStates.map((s, i) => (
            <span key={s.abbr}>
              {i > 0 && " · "}
              {s.abbr}{" "}
              <span className="font-mono font-bold tabular-nums" style={{ color: riskColor(s.score) }}>
                {s.score}
              </span>
            </span>
          ))}
        </Row>

        <Row label="Coverage">{pulse.statesScored} states scored</Row>
      </div>

      <div className="text-[0.6rem] text-text-muted mt-3 pt-2.5 border-t border-border leading-snug">
        {isLive ? (
          <>ENSO signal is live from NOAA CPC. State risk index and exposure are from the static research dataset.</>
        ) : (
          <>NOAA feed unreachable — showing the static research dataset for every field, not real-time.</>
        )}
      </div>
    </div>
  );
}
