import type { NationalPulse } from "@/lib/dataUtils";
import type { MapHighlight } from "./HomeMapExperience";

const EXPOSURE_COLOR = "#B45309";

const box = "hud-card rounded-lg border border-border-strong bg-white px-3 py-2 shadow-xl";
const button = "hud-card rounded-lg border border-border-strong bg-white px-2 py-1.5 shadow-xl text-center transition-colors";
const buttonLabel = "block truncate text-[0.58rem] font-mono font-semibold uppercase tracking-tight text-text-muted";
const activeButton = "!bg-el-nino-strong !border-el-nino-strong";
const sectionHeading = "text-[0.6rem] font-mono font-semibold uppercase tracking-widest text-white px-0.5";

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
      <div className={sectionHeading}>Primary Exposure</div>
      <div className={box}>
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
          className={`${button} flex-1 min-w-0 ${topExposureActive ? activeButton : "hover:border-la-nina-deep"}`}
        >
          <span className={topExposureActive ? "block truncate text-[0.58rem] font-mono font-semibold uppercase tracking-tight text-white" : buttonLabel}>
            {topExposureActive ? "Clear Exposure" : "Highest Exposure"}
          </span>
        </button>

        <button onClick={onOpenTopRisks} className={`${button} flex-1 min-w-0 hover:border-la-nina-deep`}>
          <span className={buttonLabel}>Today&rsquo;s Top Risks</span>
        </button>
      </div>

      <div className={`${sectionHeading} mt-1`}>Use Agent</div>
      <div className="flex gap-2">
        <button onClick={onOpenReport} className={`${button} flex-1 min-w-0 hover:border-la-nina-deep`}>
          <span className={buttonLabel}>Agent Report</span>
        </button>

        <button
          onClick={onToggleSentinel}
          aria-pressed={showSentinel}
          className={`${button} flex-1 min-w-0 ${showSentinel ? activeButton : "hover:border-la-nina-deep"}`}
        >
          <span className={showSentinel ? "block truncate text-[0.58rem] font-mono font-semibold uppercase tracking-tight text-white" : buttonLabel}>
            Agent Sentinel
          </span>
        </button>
      </div>

      <div className={`${sectionHeading} mt-1`}>Risk Views</div>
      <button
        onClick={onToggleSupplyChain}
        aria-pressed={showSupplyChain}
        className={`${button} w-full ${showSupplyChain ? activeButton : "hover:border-la-nina-deep"}`}
      >
        <span className={showSupplyChain ? "block truncate text-[0.58rem] font-mono font-semibold uppercase tracking-tight text-white" : buttonLabel}>
          {showSupplyChain ? "Clear Supply Chain View" : "Supply Chain Risk"}
        </span>
      </button>

      <button
        onClick={onToggleWildfireRisk}
        aria-pressed={showWildfireRisk}
        className={`${button} w-full ${showWildfireRisk ? activeButton : "hover:border-la-nina-deep"}`}
      >
        <span className={showWildfireRisk ? "block truncate text-[0.58rem] font-mono font-semibold uppercase tracking-tight text-white" : buttonLabel}>
          {showWildfireRisk ? "Clear Wildfire View" : "Wildfire & Livestock Risk"}
        </span>
      </button>
    </div>
  );
}
