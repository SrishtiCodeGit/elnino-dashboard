import { getStateImpact } from "./data";
import { fetchLiveSignals } from "./liveSignals";
import type { LiveSignals } from "./liveSignals";
import type { StateImpact } from "./dataUtils";

/** Live conditions only ever add risk on top of the research baseline; a calm
 * week doesn't make a state safer than its structural exposure says it is. */
const MAX_ALERT_POINTS = 5;
const MAX_DROUGHT_POINTS = 6;

// Drought hurts financial exposure through agriculture, so the same drought
// footprint counts for less in states with little commodity exposure.
const DROUGHT_EXPOSURE_WEIGHT: Record<StateImpact["commodityExposure"], number> = {
  high: 1,
  medium: 0.6,
  low: 0.3,
};

/** Pure: baseline states + signals in, adjusted states out. Each hazard type
 * counts once per state no matter how many zones it covers: Severe = 1 point,
 * Extreme = 2, capped at 5. Drought adds up to 6 points scaled by the share
 * of the state in D2+ drought and its commodity exposure. */
export function applyLiveSignals(states: StateImpact[], signals: LiveSignals): StateImpact[] {
  if (!signals.alerts && !signals.drought) return states;

  return states.map((s) => {
    const alerts = signals.alerts?.[s.abbr] ?? [];
    const drought = signals.drought?.[s.abbr] ?? null;

    const alertPoints = Math.min(
      MAX_ALERT_POINTS,
      alerts.reduce((sum, a) => sum + (a.severity === "Extreme" ? 2 : 1), 0)
    );
    const droughtPoints = drought
      ? Math.round((drought.d2Plus / 100) * MAX_DROUGHT_POINTS * DROUGHT_EXPOSURE_WEIGHT[s.commodityExposure])
      : 0;

    const score = Math.min(100, s.financialRiskScore + alertPoints + droughtPoints);
    return {
      ...s,
      financialRiskScore: score,
      live: {
        baselineScore: s.financialRiskScore,
        adjustment: score - s.financialRiskScore,
        alertPoints,
        droughtPoints,
        alerts,
        droughtD2Plus: drought?.d2Plus ?? null,
        droughtWeekOf: drought?.weekOf ?? null,
      },
    };
  });
}

export async function getLiveStateImpact(): Promise<{ states: StateImpact[]; signals: LiveSignals }> {
  const signals = await fetchLiveSignals();
  return { states: applyLiveSignals(getStateImpact(), signals), signals };
}

/** One-line "why" for a state's live adjustment, e.g.
 * "baseline 70 +6 live: Flash Flood Warning, 40% in D2+ drought". */
export function describeLive(s: StateImpact): string | null {
  const live = s.live;
  if (!live || live.adjustment === 0) return null;
  const parts = live.alerts.map((a) => a.event);
  if (live.droughtPoints > 0 && live.droughtD2Plus != null) {
    parts.push(`${Math.round(live.droughtD2Plus)}% in D2+ drought`);
  }
  return `baseline ${live.baselineScore} +${live.adjustment} live: ${parts.join(", ")}`;
}
