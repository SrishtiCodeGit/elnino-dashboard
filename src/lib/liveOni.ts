import { classifyOni, type OniRecord } from "./dataUtils";

const NOAA_ONI_URL = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt";

const SEASON_MONTH: Record<string, number> = {
  DJF: 1,
  JFM: 2,
  FMA: 3,
  MAM: 4,
  AMJ: 5,
  MJJ: 6,
  JJA: 7,
  JAS: 8,
  ASO: 9,
  SON: 10,
  OND: 11,
  NDJ: 12,
};

/** Fetches the live Oceanic Nino Index straight from NOAA's public CPC feed
 * (the same measurement the static data/raw/oni_enso.csv was seeded from),
 * instead of reading the pre-generated build-time JSON. Revalidates hourly
 * — NOAA only republishes this monthly, so that's already far fresher than
 * a manual rebuild, without hammering their server on every request.
 * Returns null on any failure so callers can fall back to the static file
 * rather than show a broken card. */
export async function fetchLiveOni(): Promise<OniRecord[] | null> {
  try {
    const res = await fetch(NOAA_ONI_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split("\n").slice(1);

    const records: OniRecord[] = [];
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) continue;
      const [season, yearStr, , anomStr] = parts;
      const month = SEASON_MONTH[season];
      const year = Number(yearStr);
      const anom = Number(anomStr);
      if (!month || !Number.isFinite(year) || !Number.isFinite(anom)) continue;
      records.push({
        date: `${year}-${String(month).padStart(2, "0")}-01`,
        season,
        year,
        ONI: anom,
        phase: classifyOni(anom),
      });
    }
    return records.length ? records : null;
  } catch {
    return null;
  }
}
