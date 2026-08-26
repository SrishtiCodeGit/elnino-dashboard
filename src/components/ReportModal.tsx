"use client";

import { useState } from "react";
import { riskColor } from "@/lib/theme";
import type { StateImpact } from "@/lib/dataUtils";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function ReportModal({ states, onClose }: { states: StateImpact[]; onClose: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function toggle(abbr: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(abbr)) next.delete(abbr);
      else next.add(abbr);
      return next;
    });
  }

  async function handleSend() {
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ abbrs: [...selected], email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send report");
      setStatus("sent");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Failed to send report");
    }
  }

  const emailValid = isValidEmail(email);
  const canSend = selected.size > 0 && emailValid && status !== "sending";

  return (
    <div className="light-cards fixed inset-0 z-40 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-fade" onClick={onClose} />

      <div className="modal-pop relative w-full max-w-lg max-h-[85vh] rounded-xl border border-border-strong bg-elevated shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-text-primary">Generate Report</h2>
            <p className="text-[0.78rem] text-text-secondary mt-0.5">
              Select states and an email to send the risk summary to.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 shrink-0 rounded-full border border-border-strong bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="5" x2="19" y2="19" />
              <line x1="19" y1="5" x2="5" y2="19" />
            </svg>
          </button>
        </div>

        {status === "sent" ? (
          <div className="px-6 py-10 text-center">
            <div className="text-[0.95rem] font-semibold text-text-primary mb-1">Report sent</div>
            <p className="text-[0.8rem] text-text-secondary">
              Sent to {email} for {selected.size} state{selected.size === 1 ? "" : "s"}.
            </p>
            <button onClick={onClose} className="mt-4 text-[0.8rem] font-medium text-la-nina-deep hover:underline">
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="px-6 py-3 border-b border-border flex items-center justify-between">
              <span className="text-[0.72rem] text-text-secondary">{selected.size} selected</span>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelected(new Set(states.map((s) => s.abbr)))}
                  className="text-[0.72rem] font-medium text-la-nina-deep hover:underline"
                >
                  Select all
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-[0.72rem] font-medium text-text-muted hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="overflow-y-auto px-2 py-2 flex-1">
              {states.map((s) => (
                <label
                  key={s.abbr}
                  className="flex items-center gap-3 px-4 py-2 rounded-md hover:bg-black/[0.03] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(s.abbr)}
                    onChange={() => toggle(s.abbr)}
                    className="w-4 h-4 accent-la-nina-deep"
                  />
                  <span className="flex-1 text-[0.82rem] text-text-primary">{s.state}</span>
                  <span
                    className="text-[0.76rem] font-mono font-bold tabular-nums"
                    style={{ color: riskColor(s.financialRiskScore) }}
                  >
                    {s.financialRiskScore}
                  </span>
                </label>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-border">
              <label className="block text-[0.68rem] font-mono font-semibold uppercase tracking-widest text-text-muted mb-1.5">
                Send to
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full text-[0.85rem] text-text-primary bg-surface border border-border-strong rounded-md px-3 py-2 outline-none focus:border-la-nina-deep"
              />
              {status === "error" && <p className="text-[0.72rem] text-el-nino-strong mt-1.5">{errorMsg}</p>}
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="w-full mt-3 rounded-md bg-la-nina-deep text-white text-[0.85rem] font-semibold py-2.5 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                {status === "sending" ? "Sending…" : `Send report${selected.size ? ` (${selected.size})` : ""}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
