import { STATES } from "./states";

const NWS_ALERTS_URL = "https://api.weather.gov/alerts/active?status=actual";
const USDM_URL =
  "https://usdmdataservices.unl.edu/api/StateStatistics/GetDroughtSeverityStatisticsByAreaPercent";
const NWS_HEADERS = {
  "User-Agent": "(elnino-financial-dashboard, research project contact via GitHub)",
  Accept: "application/geo+json",
};

const ALERT_TTL_MS = 5 * 60 * 1000;
// The Drought Monitor publishes once a week (Thursdays), so polling it more
// often than a few hours would only re-download identical data.
const DROUGHT_TTL_MS = 3 * 60 * 60 * 1000;

export interface StateAlert {
  event: string;
  severity: "Severe" | "Extreme";
}

export interface StateDrought {
  /** % of the state's area in D2 (Severe) drought or worse. */
  d2Plus: number;
  /** ISO date the Drought Monitor map is valid from. */
  weekOf: string;
}

export interface LiveSignals {
  alerts: Record<string, StateAlert[]> | null;
  drought: Record<string, StateDrought> | null;
  alertsFetchedAt: string | null;
  droughtWeekOf: string | null;
}

let alertCache: { at: number; data: Record<string, StateAlert[]> } | null = null;
let droughtCache: { at: number; data: Record<string, StateDrought> } | null = null;

const STATE_ABBRS = new Set(STATES.map((s) => s.abbr));

/** Active Warning/Emergency-level NWS alerts rated Severe or Extreme, grouped
 * by state and de-duplicated by hazard type. Watches and advisories are left
 * out on purpose: a watch means conditions *could* develop, a warning means
 * the hazard is occurring or imminent. Marine zones have non-state UGC
 * prefixes (e.g. ANZ, GMZ) and drop out via the state filter. */
async function fetchAlerts(): Promise<Record<string, StateAlert[]> | null> {
  if (alertCache && Date.now() - alertCache.at < ALERT_TTL_MS) return alertCache.data;
  try {
    // no-store: this payload is ~2 MB, over Next's 2 MB fetch-cache limit,
    // so the in-memory cache above is what keeps request volume down.
    const res = await fetch(NWS_ALERTS_URL, {
      headers: NWS_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return alertCache?.data ?? null;
    const json = await res.json();
    const byState = new Map<string, Map<string, StateAlert>>();

    for (const f of json?.features ?? []) {
      const p = f?.properties;
      const severity = p?.severity;
      const event: unknown = p?.event;
      if (typeof event !== "string") continue;
      if (severity !== "Severe" && severity !== "Extreme") continue;
      if (!/(Warning|Emergency)$/.test(event)) continue;
      const ugc: string[] = p?.geocode?.UGC ?? [];
      for (const code of new Set(ugc.map((u) => u.slice(0, 2)))) {
        if (!STATE_ABBRS.has(code)) continue;
        const events = byState.get(code) ?? new Map<string, StateAlert>();
        const existing = events.get(event);
        if (!existing || (severity === "Extreme" && existing.severity !== "Extreme")) {
          events.set(event, { event, severity });
        }
        byState.set(code, events);
      }
    }

    const data: Record<string, StateAlert[]> = {};
    for (const [abbr, events] of byState) data[abbr] = [...events.values()];
    alertCache = { at: Date.now(), data };
    return data;
  } catch {
    return alertCache?.data ?? null;
  }
}

function usdmDate(d: Date): string {
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
}

async function fetchStateDrought(fips: string, start: string, end: string): Promise<StateDrought | null> {
  try {
    const url = `${USDM_URL}?aoi=${fips}&startdate=${start}&enddate=${end}&statisticsType=1`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { mapDate: string; d2: number }[];
    if (!Array.isArray(rows) || !rows.length) return null;
    const latest = rows.reduce((a, b) => (a.mapDate >= b.mapDate ? a : b));
    if (typeof latest.d2 !== "number") return null;
    return { d2Plus: latest.d2, weekOf: latest.mapDate.slice(0, 10) };
  } catch {
    return null;
  }
}

/** Latest weekly US Drought Monitor reading per state: the share of the
 * state's land area in D2 (Severe) drought or worse. */
async function fetchDrought(): Promise<Record<string, StateDrought> | null> {
  if (droughtCache && Date.now() - droughtCache.at < DROUGHT_TTL_MS) return droughtCache.data;
  const end = new Date();
  const start = new Date(end.getTime() - 21 * 24 * 60 * 60 * 1000);
  const results = await Promise.all(
    STATES.map(async (s) => [s.abbr, await fetchStateDrought(s.fips, usdmDate(start), usdmDate(end))] as const)
  );
  const data: Record<string, StateDrought> = {};
  for (const [abbr, d] of results) if (d) data[abbr] = d;
  if (!Object.keys(data).length) return droughtCache?.data ?? null;
  droughtCache = { at: Date.now(), data };
  return data;
}

/** Either feed can fail independently; the corresponding field is then null
 * and the score simply gets no adjustment from it. */
export async function fetchLiveSignals(): Promise<LiveSignals> {
  const [alerts, drought] = await Promise.all([fetchAlerts(), fetchDrought()]);
  const weeks = drought ? Object.values(drought).map((d) => d.weekOf) : [];
  return {
    alerts,
    drought,
    alertsFetchedAt: alertCache ? new Date(alertCache.at).toISOString() : null,
    droughtWeekOf: weeks.length ? weeks.reduce((a, b) => (a >= b ? a : b)) : null,
  };
}
