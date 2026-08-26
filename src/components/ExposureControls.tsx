import type { NationalPulse } from "@/lib/dataUtils";
import type { MapHighlight } from "./HomeMapExperience";

const EXPOSURE_COLOR = "#B45309";

const box = "hud-card rounded-lg border border-border-strong bg-elevated/90 backdrop-blur px-3 py-2 shadow-xl";
const kicker = "text-[0.6rem] font-mono font-semibold uppercase tracking-widest text-text-muted";

export function ExposureControls({
  pulse,
  highlight,
  onHighlightChange,
  onOpenTopRisks,
  onOpenReport,
  showSupplyChain,
  onToggleSupplyChain,
  showWildfireRisk,
  onToggleWildfireRisk,
  showSentinel,
  onToggleSentinel,
}: {
  pulse: NationalPulse;
  highlight: MapHighlight | null;
  onHighlightChange: (h: MapHighlight | null) => void;
  onOpenTopRisks: () => void;
  onOpenReport: () => void;
  showSupplyChain: boolean;
  onToggleSupplyChain: () => void;
  showWildfireRisk: boolean;
  onToggleWildfireRisk: () => void;
  showSentinel: boolean;
  onToggleSentinel: () => void;
}) {
  const topExposureActive = highlight?.type === "topExposure";
  const selectedCommodity = highlight?.type === "commodity" ? highlight.value : "";

  return (
    <div className="flex flex-col gap-2.5">
      <div className={box}>
        <div className={kicker}>Primary Exposure</div>
        <p className="text-[0.68rem] text-text-muted mt-0.5 mb-1.5 leading-snug">
          Select a commodity to highlight where it drives exposure most.
        </p>
        <select
          value={selectedCommodity}
          onChange={(e) => {
            const value = e.target.value;
            onHighlightChange(value ? { type: "commodity", value } : null);
          }}
          className="w-full text-[0.78rem] font-medium text-text-primary bg-surface border border-border-strong rounded-md px-2 py-1.5 outline-none focus:border-la-nina-deep"
        >
          <option value="">States</option>
          {pulse.primaryExposure.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {selectedCommodity && (
          <div className="mt-1.5">
            <span
              className="text-[0.7rem] font-semibold px-1.5 py-0.5 rounded"
              style={{ color: EXPOSURE_COLOR, background: "rgba(180,83,9,0.1)" }}
            >
              Highlighting {selectedCommodity} exposure on the map
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onHighlightChange(topExposureActive ? null : { type: "topExposure" })}
          aria-pressed={topExposureActive}
          className={`hud-card rounded-lg border border-border-strong bg-elevated/90 backdrop-blur px-2 py-1.5 shadow-xl flex-1 min-w-0 text-center transition-colors ${
            topExposureActive ? "!bg-el-nino-strong !border-el-nino-strong" : "hover:border-la-nina-deep"
          }`}
        >
          <span
            className={`block truncate text-[0.58rem] font-mono font-semibold uppercase tracking-tight ${
              topExposureActive ? "text-white" : "text-text-muted"
            }`}
          >
            {topExposureActive ? "Clear Exposure" : "Highest Exposure"}
          </span>
        </button>

        <button
          onClick={onOpenTopRisks}
          className="hud-card rounded-lg border border-border-strong bg-elevated/90 backdrop-blur px-2 py-1.5 shadow-xl flex-1 min-w-0 text-center hover:border-la-nina-deep transition-colors"
        >
          <span className="block truncate text-[0.58rem] font-mono font-semibold uppercase tracking-tight text-text-muted">
            Today&rsquo;s Top Risks
          </span>
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onOpenReport}
          className="hud-card rounded-lg border border-border-strong bg-elevated/90 backdrop-blur px-2 py-1.5 shadow-xl flex-1 min-w-0 text-center hover:border-la-nina-deep transition-colors"
        >
          <span className="block truncate text-[0.58rem] font-mono font-semibold uppercase tracking-tight text-text-muted">
            Agent Report
          </span>
        </button>

        <button
          onClick={onToggleSentinel}
          aria-pressed={showSentinel}
          className={`hud-card rounded-lg border border-border-strong bg-elevated/90 backdrop-blur px-2 py-1.5 shadow-xl flex-1 min-w-0 text-center transition-colors ${
            showSentinel ? "!bg-el-nino-strong !border-el-nino-strong" : "hover:border-la-nina-deep"
          }`}
        >
          <span
            className={`block truncate text-[0.58rem] font-mono font-semibold uppercase tracking-tight ${
              showSentinel ? "text-white" : "text-text-muted"
            }`}
          >
            Agent Sentinel
          </span>
        </button>
      </div>

      <button
        onClick={onToggleSupplyChain}
        aria-pressed={showSupplyChain}
        className={`hud-card rounded-lg border border-border-strong bg-elevated/90 backdrop-blur px-2 py-1.5 shadow-xl w-full text-center transition-colors ${
          showSupplyChain ? "!bg-el-nino-strong !border-el-nino-strong" : "hover:border-la-nina-deep"
        }`}
      >
        <span
          className={`block truncate text-[0.58rem] font-mono font-semibold uppercase tracking-tight ${
            showSupplyChain ? "text-white" : "text-text-muted"
          }`}
        >
          {showSupplyChain ? "Clear Supply Chain View" : "Supply Chain Risk"}
        </span>
      </button>

      <button
        onClick={onToggleWildfireRisk}
        aria-pressed={showWildfireRisk}
        className={`hud-card rounded-lg border border-border-strong bg-elevated/90 backdrop-blur px-2 py-1.5 shadow-xl w-full text-center transition-colors ${
          showWildfireRisk ? "!bg-el-nino-strong !border-el-nino-strong" : "hover:border-la-nina-deep"
        }`}
      >
        <span
          className={`block truncate text-[0.58rem] font-mono font-semibold uppercase tracking-tight ${
            showWildfireRisk ? "text-white" : "text-text-muted"
          }`}
        >
          {showWildfireRisk ? "Clear Wildfire View" : "Wildfire & Livestock Risk"}
        </span>
      </button>
    </div>
  );
}
