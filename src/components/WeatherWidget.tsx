"use client";

import { useEffect, useState, useCallback } from "react";
import { CountUpNumber } from "@/components/CountUpNumber";
import type { CurrentWeather } from "@/lib/weather";

export function WeatherWidget({ abbr }: { abbr: string }) {
  const [data, setData] = useState<CurrentWeather | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/weather/${abbr}`, { cache: "no-store" });
      if (!res.ok) throw new Error("bad response");
      setData(await res.json());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [abbr]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount; setState only runs after the awaited fetch resolves, not synchronously during this effect
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface px-5 py-4 h-full animate-pulse">
        <div className="h-3 w-24 bg-elevated rounded mb-3" />
        <div className="h-8 w-32 bg-elevated rounded" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-border bg-surface px-5 py-4 h-full">
        <div className="text-[0.7rem] font-semibold tracking-wider uppercase text-text-muted mb-2">
          Live Weather
        </div>
        <div className="text-sm text-text-muted">Unavailable right now (NOAA/NWS)</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-4 h-full">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[0.7rem] font-semibold tracking-wider uppercase text-text-muted">
          Live Weather &middot; {data.city}
        </div>
        <span className="w-1.5 h-1.5 rounded-full bg-green pulse-dot" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[1.75rem] font-bold font-mono tracking-tight tabular-nums text-text-primary">
          {data.temperatureF != null ? <CountUpNumber value={data.temperatureF} /> : "—"}&deg;F
        </span>
        {data.temperatureC != null && (
          <span className="text-sm font-mono text-text-muted">({data.temperatureC}&deg;C)</span>
        )}
      </div>
      <div className="text-[0.78rem] text-text-secondary mt-1">
        {data.textDescription ?? "Conditions unavailable"}
        {data.windSpeed && <> &middot; Wind {data.windSpeed}</>}
        {data.relativeHumidity != null && <> &middot; Humidity {data.relativeHumidity}%</>}
      </div>
      <div className="text-[0.68rem] text-text-muted mt-2">
        {data.stationName ?? "NWS station"}
        {data.observedAt && (
          <> &middot; {new Date(data.observedAt).toLocaleTimeString()}</>
        )}
      </div>
    </div>
  );
}
