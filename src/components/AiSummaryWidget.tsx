"use client";

import { useCallback, useEffect, useState } from "react";

export function AiSummaryWidget({ abbr }: { abbr: string }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ai-summary/${abbr}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI summary unavailable");
      setSummary(data.summary);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI summary unavailable");
    } finally {
      setLoading(false);
    }
  }, [abbr]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount; setState only runs after the awaited fetch resolves, not synchronously during this effect
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface px-5 py-4 animate-pulse">
        <div className="h-3 w-20 bg-elevated rounded mb-3" />
        <div className="h-3 w-full bg-elevated rounded mb-2" />
        <div className="h-3 w-4/5 bg-elevated rounded" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="rounded-xl border border-border bg-surface px-5 py-4">
        <div className="text-[0.7rem] font-semibold tracking-wider uppercase text-text-muted mb-2">
          AI Summary
        </div>
        <div className="text-sm text-text-muted">{error ?? "Unavailable right now"}</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-[0.7rem] font-semibold tracking-wider uppercase text-text-muted">
          AI Summary
        </div>
        <span className="text-[0.6rem] font-mono px-1.5 py-0.5 rounded bg-elevated text-text-muted border border-border">
          Claude
        </span>
      </div>
      <p className="text-[0.85rem] text-text-secondary leading-relaxed">{summary}</p>
      <p className="text-[0.62rem] text-text-muted mt-2">
        Generated from the data on this page — not a substitute for the sources below.
      </p>
    </div>
  );
}
