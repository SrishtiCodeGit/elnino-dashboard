"use client";

import { useEffect, useRef, useState } from "react";
import { useDraggable } from "@/hooks/useDraggable";
import { riskColor } from "@/lib/theme";
import { makeSentinelEvent } from "@/lib/sentinel";
import type { SentinelEvent } from "@/lib/sentinel";
import type { NationalPulse, StateImpact } from "@/lib/dataUtils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const EMAIL_STORAGE_KEY = "elnino-agent-email";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** The floating, draggable, scrollable "Agent Report" panel — a chat with
 * the dashboard's research agent (Claude, grounded strictly in the real
 * dataset via /api/agent-chat) plus an Email Report action that reuses the
 * existing /api/generate-report pipeline (PDF + AI briefing + live weather),
 * targeting whichever states the conversation was actually about. Replaces
 * the old static "Generate Report" modal. */
export function AgentReportPanel({
  states,
  pulse,
  onClose,
  pushEvent,
}: {
  states: StateImpact[];
  pulse: NationalPulse;
  onClose: () => void;
  pushEvent: (event: SentinelEvent) => void;
}) {
  const { pos, dragHandleProps } = useDraggable({ x: 96, y: 96 });
  const defaultAbbrs = pulse.topStates.map((s) => s.abbr).slice(0, 5);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Live view: national risk index is ${pulse.index}/100 (${pulse.severity}), ${pulse.statesScored} states scored, ${pulse.topStates.length} in the current top-risk set. Ask me about a state, a commodity, or a region — I'll answer from the dataset, and Email Report will send whatever we just discussed.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [focusAbbrs, setFocusAbbrs] = useState<string[]>(defaultAbbrs);

  const [email, setEmail] = useState(() =>
    typeof window !== "undefined" ? window.localStorage.getItem(EMAIL_STORAGE_KEY) ?? "" : ""
  );
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [emailError, setEmailError] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  async function handleSend() {
    const message = input.trim();
    if (!message || thinking) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: message }];
    setMessages(nextMessages);
    setInput("");
    setThinking(true);
    try {
      const res = await fetch("/api/agent-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: nextMessages.slice(0, -1) }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (Array.isArray(data.focusAbbrs) && data.focusAbbrs.length > 0) {
        setFocusAbbrs(data.focusAbbrs);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Couldn't reach the agent — try again in a moment." }]);
    } finally {
      setThinking(false);
    }
  }

  async function handleEmail() {
    if (!isValidEmail(email)) {
      setEmailStatus("error");
      setEmailError("Enter a valid email address");
      return;
    }
    if (typeof window !== "undefined") window.localStorage.setItem(EMAIL_STORAGE_KEY, email);

    const abbrs = focusAbbrs.length > 0 ? focusAbbrs : defaultAbbrs;
    setEmailStatus("sending");
    setEmailError("");
    try {
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ abbrs, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send report");
      setEmailStatus("sent");
      const stateNames = abbrs.map((a) => states.find((s) => s.abbr === a)?.state ?? a).join(", ");
      pushEvent(makeSentinelEvent("email", "success", `Report emailed to ${email}`, `${abbrs.length} state${abbrs.length === 1 ? "" : "s"}: ${stateNames}`));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send report";
      setEmailStatus("error");
      setEmailError(msg);
      pushEvent(makeSentinelEvent("email", "error", `Failed to email report to ${email}`, msg));
    }
  }

  return (
    <div
      className="light-cards modal-pop fixed z-30 w-[380px] max-w-[92vw] rounded-xl border border-border-strong bg-elevated shadow-2xl flex flex-col overflow-hidden"
      style={{ left: pos.x, top: pos.y, height: 520 }}
    >
      <div
        className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border cursor-grab active:cursor-grabbing shrink-0 touch-none"
        style={{ background: "rgba(56,189,248,0.06)" }}
        {...dragHandleProps}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-la-nina-strong shrink-0" />
            <h2 className="text-[0.82rem] font-bold tracking-tight text-text-primary truncate">Agent Report</h2>
          </div>
          <p className="text-[0.66rem] text-text-muted truncate">Drag header to move &middot; ask, then email</p>
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

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-2.5">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[86%] rounded-lg px-3 py-2 text-[0.78rem] leading-snug ${
              m.role === "user"
                ? "self-end bg-la-nina-deep text-white"
                : "self-start bg-surface border border-border text-text-primary"
            }`}
          >
            {m.content}
          </div>
        ))}
        {thinking && (
          <div className="self-start bg-surface border border-border rounded-lg px-3 py-2 text-[0.78rem] text-text-muted">
            Thinking&hellip;
          </div>
        )}
      </div>

      {focusAbbrs.length > 0 && (
        <div className="px-4 pt-2 pb-1 flex flex-wrap gap-1 shrink-0">
          {focusAbbrs.map((abbr) => {
            const s = states.find((st) => st.abbr === abbr);
            return (
              <span
                key={abbr}
                className="text-[0.62rem] font-mono font-semibold px-1.5 py-0.5 rounded"
                style={{ color: riskColor(s?.financialRiskScore ?? 0), background: "rgba(148,163,184,0.12)" }}
              >
                {abbr}
              </span>
            );
          })}
        </div>
      )}

      <div className="px-3 py-2.5 border-t border-border shrink-0 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask about a state, region, or commodity…"
          className="flex-1 min-w-0 text-[0.78rem] text-text-primary bg-surface border border-border-strong rounded-md px-2.5 py-1.5 outline-none focus:border-la-nina-deep"
        />
        <button
          onClick={handleSend}
          disabled={thinking || !input.trim()}
          className="shrink-0 rounded-md bg-la-nina-deep text-white text-[0.72rem] font-semibold px-3 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          Ask
        </button>
      </div>

      <div className="px-3 pb-3 pt-1 border-t border-border shrink-0">
        {emailStatus === "sent" ? (
          <div className="flex items-center justify-between gap-2 text-[0.72rem]">
            <span className="text-la-nina-deep font-medium">Sent to {email}</span>
            <button onClick={() => setEmailStatus("idle")} className="text-text-muted hover:underline">
              Send again
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailStatus === "error") setEmailStatus("idle");
              }}
              placeholder="you@example.com"
              className="flex-1 min-w-0 text-[0.76rem] text-text-primary bg-surface border border-border-strong rounded-md px-2.5 py-1.5 outline-none focus:border-la-nina-deep"
            />
            <button
              onClick={handleEmail}
              disabled={emailStatus === "sending"}
              className="shrink-0 rounded-md border border-la-nina-deep text-la-nina-deep text-[0.72rem] font-semibold px-3 disabled:opacity-40 transition-opacity hover:bg-la-nina-deep hover:text-white"
            >
              {emailStatus === "sending" ? "Sending…" : "Email Report"}
            </button>
          </div>
        )}
        {emailStatus === "error" && <p className="text-[0.68rem] text-el-nino-strong mt-1.5">{emailError}</p>}
      </div>
    </div>
  );
}
