const NWS_HEADERS = {
  "User-Agent": "(elnino-financial-dashboard, research project contact via GitHub)",
  Accept: "application/geo+json",
};

export interface CurrentWeather {
  city: string;
  temperatureC: number | null;
  temperatureF: number | null;
  textDescription: string | null;
  windSpeed: string | null;
  relativeHumidity: number | null;
  observedAt: string | null;
  stationName: string | null;
}

async function nwsFetch(url: string) {
  const res = await fetch(url, { headers: NWS_HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(`NWS ${res.status} for ${url}`);
  return res.json();
}

/** Server-side only. Looks up current conditions for a lat/lon via api.weather.gov. */
export async function getCurrentWeather(
  lat: number,
  lon: number,
  cityLabel: string
): Promise<CurrentWeather | null> {
  try {
    const point = await nwsFetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`);
    const stationsUrl: string | undefined = point?.properties?.observationStations;
    if (!stationsUrl) return null;

    const stations = await nwsFetch(stationsUrl);
    const stationId: string | undefined = stations?.features?.[0]?.properties?.stationIdentifier;
    const stationName: string | undefined = stations?.features?.[0]?.properties?.name;
    if (!stationId) return null;

    const obs = await nwsFetch(`https://api.weather.gov/stations/${stationId}/observations/latest`);
    const p = obs?.properties;
    if (!p) return null;

    const tempC = typeof p.temperature?.value === "number" ? p.temperature.value : null;
    return {
      city: cityLabel,
      temperatureC: tempC,
      temperatureF: tempC != null ? Math.round((tempC * 9) / 5 + 32) : null,
      textDescription: p.textDescription ?? null,
      windSpeed:
        typeof p.windSpeed?.value === "number" ? `${Math.round(p.windSpeed.value)} km/h` : null,
      relativeHumidity:
        typeof p.relativeHumidity?.value === "number" ? Math.round(p.relativeHumidity.value) : null,
      observedAt: p.timestamp ?? null,
      stationName: stationName ?? null,
    };
  } catch (e) {
    console.error("getCurrentWeather failed:", (e as Error).message);
    return null;
  }
}
