"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDraggable } from "@/hooks/useDraggable";
import { makeSentinelEvent } from "@/lib/sentinel";
import type { SentinelEvent } from "@/lib/sentinel";

const PHONE_STORAGE_KEY = "elnino-agent-phone";
const MONITOR_STORAGE_KEY = "elnino-agent-monitoring";
const POLL_MS = 60_000;

function isValidPhone(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

function relativeTime(ts: number): string {
  const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  return `${diffHr}h ago`;
}

const TYPE_ICON: Record<SentinelEvent["type"], string> = {
  report: "\u{1F4CB}",
  email: "\u{2709}\u{FE0F}",
  sms: "\u{1F4F1}",
  check: "\u{1F50D}",
};

const STATUS_COLOR: Record<SentinelEvent["status"], string> = {
  success: "var(--color-la-nina-deep, #0EA5E9)",
  error: "#EF4444",
  info: "#94A3B8",
};

/** The floating, draggable, scrollable "Agent Sentinel" panel — logs every
 * agent action (report generated, email sent, risk checks) and owns the
 * live risk monitor: polls /api/risk-check on an interval, and any state
 * that newly crosses into Severe triggers a real SMS via Twilio to the
 * registered number, logged here either way (sent or failed/unconfigured). */
export function AgentSentinelPanel({
  events,
  pushEvent,
  onClose,
}: {
  events: SentinelEvent[];
  pushEvent: (event: SentinelEvent) => void;
  onClose: () => void;
}) {
  const { pos, dragHandleProps } = useDraggable({ x: 96, y: 640 });
  const [phone, setPhone] = useState(() => (typeof window !== "undefined" ? window.localStorage.getItem(PHONE_STORAGE_KEY) ?? "" : ""));
  const [monitoring, setMonitoring] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(MONITOR_STORAGE_KEY) === "1"
  );
  const [checking, setChecking] = useState(false);
  const [, forceTick] = useState(0);
  const phoneRef = useRef(phone);

  useEffect(() => {
    phoneRef.current = phone;
  }, [phone]);

  useEffect(() => {
    window.localStorage.setItem(MONITOR_STORAGE_KEY, monitoring ? "1" : "0");
  }, [monitoring]);

  // Re-render every 20s so "Xs ago" timestamps in the log stay fresh
  // without needing a per-second timer.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 20_000);
    return () => clearInterval(id);
  }, []);

  const runCheck = useCallback(async () => {
    setChecking(true);
    const currentPhone = phoneRef.current;
    try {
      const res = await fetch("/api/risk-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: isValidPhone(currentPhone) ? currentPhone : undefined }),
      });
      const data = await res.json();
      if (data.initialized) {
        pushEvent(makeSentinelEvent("check", "info", "Monitoring started", "Baseline severity snapshot recorded"));
        return;
      }
      const newlySevere = Array.isArray(data.newlySevere) ? data.newlySevere : [];
      if (newlySevere.length === 0) {
        pushEvent(makeSentinelEvent("check", "info", "Risk check: no change", "No state newly crossed into Severe"));
        return;
      }
      const names = newlySevere.map((s: { state: string; score: number }) => `${s.state} (${s.score})`).join(", ");
      pushEvent(makeSentinelEvent("check", "info", `${newlySevere.length} state${newlySevere.length === 1 ? "" : "s"} crossed into Severe`, names));
      if (data.smsSent) {
        pushEvent(makeSentinelEvent("sms", "success", `SMS alert sent to ${currentPhone}`, names));
      } else if (data.smsError) {
        pushEvent(makeSentinelEvent("sms", "error", "SMS alert not sent", data.smsError));
      }
    } catch {
      pushEvent(makeSentinelEvent("check", "error", "Risk check failed", "Couldn't reach the monitor endpoint"));
    } finally {
      setChecking(false);
    }
  }, [pushEvent]);

  useEffect(() => {
    if (!monitoring) return;
    // Intentional: starting the poll should run one check immediately
    // rather than waiting POLL_MS for the first result.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runCheck();
    const id = setInterval(runCheck, POLL_MS);
    return () => clearInterval(id);
  }, [monitoring, runCheck]);

  function savePhone(next: string) {
    setPhone(next);
    window.localStorage.setItem(PHONE_STORAGE_KEY, next);
  }

  const phoneValid = phone === "" || isValidPhone(phone);

  return (
    <div
      className="light-cards modal-pop fixed z-30 w-[340px] max-w-[92vw] rounded-xl border border-border-strong bg-elevated shadow-2xl flex flex-col overflow-hidden"
      style={{ left: pos.x, top: pos.y, height: 440 }}
    >
      <div
        className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border cursor-grab active:cursor-grabbing shrink-0 touch-none"
        style={{ background: "rgba(239,68,68,0.06)" }}
        {...dragHandleProps}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${monitoring ? "bg-el-nino-strong animate-pulse" : "bg-text-muted"}`} />
            <h2 className="text-[0.82rem] font-bold tracking-tight text-text-primary truncate">Agent Sentinel</h2>
          </div>
          <p className="text-[0.66rem] text-text-muted truncate">{monitoring ? "Monitoring live" : "Monitoring off"}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="w-7 h-7 shrink-0 rounded-full border border-border-strong bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="5" y1="5" x2="19" y2="19" />
            <line x1="19" y1="5" x2="5" y2="19" />
          </svg>
        </button>
      </div>

      <div className="px-4 py-2.5 border-b border-border shrink-0 flex flex-col gap-1.5">
        <input
          value={phone}
          onChange={(e) => savePhone(e.target.value)}
          placeholder="+15551234567"
          className={`text-[0.76rem] text-text-primary bg-surface border rounded-md px-2.5 py-1.5 outline-none focus:border-la-nina-deep ${
            phoneValid ? "border-border-strong" : "border-el-nino-strong"
          }`}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonitoring((m) => !m)}
            className={`flex-1 rounded-md text-[0.7rem] font-semibold py-1.5 transition-colors ${
              monitoring ? "bg-el-nino-strong text-white" : "border border-border-strong text-text-secondary hover:border-la-nina-deep"
            }`}
          >
            {monitoring ? "Stop Monitoring" : "Start Monitoring"}
          </button>
          <button
            onClick={runCheck}
            disabled={checking}
            className="rounded-md border border-border-strong text-text-secondary text-[0.7rem] font-semibold px-2.5 py-1.5 hover:border-la-nina-deep disabled:opacity-40 transition-colors"
          >
            {checking ? "…" : "Check now"}
          </button>
        </div>
        <p className="text-[0.62rem] text-text-muted leading-snug">
          Polls every 60s for states newly crossing into Severe (score ≥ 75) and texts the number above.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex flex-col-reverse gap-1.5">
        {events.length === 0 && (
          <p className="text-[0.72rem] text-text-muted text-center py-6">No activity yet.</p>
        )}
        {[...events].reverse().map((e) => (
          <div key={e.id} className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-black/[0.03]">
            <span className="text-[0.85rem] leading-none mt-0.5 shrink-0">{TYPE_ICON[e.type]}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.74rem] font-medium text-text-primary truncate" style={{ color: e.status === "error" ? "#EF4444" : undefined }}>
                  {e.message}
                </span>
                <span className="text-[0.62rem] text-text-muted shrink-0">{relativeTime(e.timestamp)}</span>
              </div>
              {e.detail && <p className="text-[0.68rem] text-text-secondary truncate">{e.detail}</p>}
            </div>
            <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: STATUS_COLOR[e.status] }} />
          </div>
        ))}
      </div>
    </div>
  );
}
