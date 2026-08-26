import type { NationalPulse } from "@/lib/dataUtils";
import type { MapHighlight } from "./HomeMapExperience";

const EXPOSURE_COLOR = "#B45309";

const box = "rounded-lg border border-border-strong bg-white px-3 py-2 shadow-xl";
const button = "rounded-lg border border-border-strong bg-white px-2 py-1.5 shadow-xl text-center transition-colors";
const buttonLabel = "block truncate text-[0.58rem] font-mono font-semibold uppercase tracking-tight text-text-muted";
const activeButton = "!bg-el-nino-strong !border-el-nino-strong";
const sectionHeading = "text-[0.6rem] font-mono font-semibold uppercase tracking-widest text-white px-0.5";
const riskTileLabel = "text-[0.56rem] font-mono font-semibold uppercase tracking-tight text-center leading-tight";

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.5 4 5.6 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.6-4-9s1.5-6.5 4-9z" />
    </svg>
  );
}

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className={className}>
      <path d="M12 22c4.4 0 7-3 7-6.8 0-2.5-1.2-4.2-2.3-5.6C15.8 8.3 15 7 15 4.5c-1.9 1.3-3.2 3.6-3.2 5.8 0 .9.2 1.7.2 1.7S10 10.2 10 7C8 8.9 7 11.8 7 14.7 7 18.5 9.2 22 12 22z" />
    </svg>
  );
}

function DollarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.5v11" />
      <path d="M15.2 9c0-1.4-1.4-2.5-3.2-2.5S8.8 7.6 8.8 9c0 1.4 1.4 2 3.2 2.5s3.2 1.1 3.2 2.5c0 1.4-1.4 2.5-3.2 2.5S8.8 15.4 8.8 14" />
    </svg>
  );
}

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
  financialRiskActive,
  onSelectFinancialRisk,
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
  financialRiskActive: boolean;
  onSelectFinancialRisk: () => void;
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
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={onSelectFinancialRisk}
          aria-pressed={financialRiskActive}
          className={`${button} aspect-square flex flex-col items-center justify-center gap-1.5 ${
            financialRiskActive ? activeButton : "hover:border-la-nina-deep"
          }`}
        >
          <DollarIcon className={`w-6 h-6 shrink-0 ${financialRiskActive ? "text-white" : "text-text-muted"}`} />
          <span className={`${riskTileLabel} ${financialRiskActive ? "text-white" : "text-text-muted"}`}>Financial Risk</span>
        </button>

        <button
          onClick={onToggleSupplyChain}
          aria-pressed={showSupplyChain}
          className={`${button} aspect-square flex flex-col items-center justify-center gap-1.5 ${
            showSupplyChain ? activeButton : "hover:border-la-nina-deep"
          }`}
        >
          <GlobeIcon className={`w-6 h-6 shrink-0 ${showSupplyChain ? "text-white" : "text-text-muted"}`} />
          <span className={`${riskTileLabel} ${showSupplyChain ? "text-white" : "text-text-muted"}`}>
            {showSupplyChain ? "Clear View" : "Supply Chain Risk"}
          </span>
        </button>

        <button
          onClick={onToggleWildfireRisk}
          aria-pressed={showWildfireRisk}
          className={`${button} aspect-square flex flex-col items-center justify-center gap-1.5 ${
            showWildfireRisk ? activeButton : "hover:border-la-nina-deep"
          }`}
        >
          <FlameIcon className={`w-6 h-6 shrink-0 ${showWildfireRisk ? "text-white" : "text-text-muted"}`} />
          <span className={`${riskTileLabel} ${showWildfireRisk ? "text-white" : "text-text-muted"}`}>
            {showWildfireRisk ? "Clear View" : "Wildfire & Livestock"}
          </span>
        </button>
      </div>
    </div>
  );
}
