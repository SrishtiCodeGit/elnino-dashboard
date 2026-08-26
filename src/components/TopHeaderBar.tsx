import { riskColor } from "@/lib/theme";
import { CountUpNumber } from "@/components/CountUpNumber";
import type { NationalPulse } from "@/lib/dataUtils";

const TREND_STYLE: Record<NationalPulse["trend"], { glyph: string; color: string }> = {
  Strengthening: { glyph: "▲", color: "#DC2626" },
  Weakening: { glyph: "▼", color: "#047857" },
  Steady: { glyph: "—", color: "#64748B" },
};

export function TopHeaderBar({ pulse, isLive }: { pulse: NationalPulse; isLive: boolean }) {
  const color = riskColor(pulse.index);
  const trend = TREND_STYLE[pulse.trend];

  return (
    <div className="light-cards w-full border-b border-border-strong bg-elevated/95 backdrop-blur pl-20 pr-5 sm:pr-8 py-2.5 flex items-center gap-8 flex-wrap">
      <div className="flex items-center gap-2.5">
        <span className="text-[0.62rem] font-mono font-semibold uppercase tracking-widest text-text-muted">
          National Risk Pulse
        </span>
        <span className="text-[1.35rem] font-mono font-extrabold leading-none tabular-nums" style={{ color }}>
          <CountUpNumber value={pulse.index} />
        </span>
        <span
          className="text-[0.62rem] font-mono font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
          style={{ color, background: "rgba(15,23,42,0.06)" }}
        >
          {pulse.severity}
        </span>
      </div>

      <span className="hidden sm:block w-px h-6 bg-border" />

      <div className="flex items-center gap-2">
        <span className="text-[0.62rem] font-mono font-semibold uppercase tracking-widest text-text-muted flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-green pulse-dot" : "bg-text-muted"}`} />
          ENSO {isLive ? "· Live" : ""}
        </span>
        <span className="text-[0.82rem] font-semibold text-text-primary">{pulse.oniPhase}</span>
        <span className="text-[0.78rem] text-text-secondary">
          <span className="font-mono tabular-nums">
            {pulse.oniValue >= 0 ? "+" : ""}
            {pulse.oniValue.toFixed(2)}&deg;C
          </span>{" "}
          <span style={{ color: trend.color, fontWeight: 700 }}>
            {trend.glyph} {pulse.trend}
          </span>
        </span>
      </div>

      <span className="hidden sm:block w-px h-6 bg-border" />

      <div className="flex items-center gap-2">
        <span className="text-[0.62rem] font-mono font-semibold uppercase tracking-widest text-text-muted">
          Coverage
        </span>
        <span className="text-[0.82rem] font-semibold text-text-primary tabular-nums">
          {pulse.statesScored} states scored
        </span>
        <span className="text-[0.68rem] text-text-muted hidden lg:inline">
          Static research dataset, not real-time
        </span>
      </div>
    </div>
  );
}
