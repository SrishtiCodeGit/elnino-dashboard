import { NextResponse } from "next/server";
import { getStateImpact } from "@/lib/data";
import { severityLabel } from "@/lib/dataUtils";
import { sendSms } from "@/lib/sms";

// Server-process-lifetime snapshot of which states were Severe (score >= 75)
// as of the last check — same single-instance-cache pattern already used in
// aiSummary.ts. Lets the monitor detect a state *newly* crossing into
// Severe instead of re-alerting on every poll. Resets on server restart; a
// multi-instance production deployment would need a shared store instead.
let lastSevere: Set<string> | null = null;

function isValidPhone(phone: string): boolean {
  // E.164-ish: leading +, 8-15 digits. Real validation happens at Twilio.
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

export async function POST(request: Request) {
  let body: { phone?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  const states = getStateImpact();
  const currentSevere = new Set(states.filter((s) => s.financialRiskScore >= 75).map((s) => s.abbr));

  // First check of this server process: establish the baseline silently —
  // otherwise every currently-Severe state would fire as "newly severe" on
  // the very first poll, which isn't a real change, just a cold start.
  if (lastSevere === null) {
    lastSevere = currentSevere;
    return NextResponse.json({ checkedAt: new Date().toISOString(), initialized: true, newlySevere: [], smsSent: false });
  }

  const newlySevereAbbrs = [...currentSevere].filter((abbr) => !lastSevere!.has(abbr));
  lastSevere = currentSevere;

  const newlySevere = newlySevereAbbrs
    .map((abbr) => states.find((s) => s.abbr === abbr))
    .filter((s): s is NonNullable<typeof s> => s != null)
    .map((s) => ({ abbr: s.abbr, state: s.state, score: s.financialRiskScore, severity: severityLabel(s.financialRiskScore) }));

  if (newlySevere.length === 0) {
    return NextResponse.json({ checkedAt: new Date().toISOString(), initialized: false, newlySevere: [], smsSent: false });
  }

  if (!phone) {
    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      initialized: false,
      newlySevere,
      smsSent: false,
      smsError: "No phone number registered",
    });
  }

  if (!isValidPhone(phone)) {
    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      initialized: false,
      newlySevere,
      smsSent: false,
      smsError: "Phone number must be in +1XXXXXXXXXX (E.164) format",
    });
  }

  const list = newlySevere.map((s) => `${s.state} (${s.score}/100)`).join(", ");
  const body_ = `El Nino Risk Alert: ${newlySevere.length === 1 ? "a state has" : "states have"} just crossed into Severe risk: ${list}.`;
  const result = await sendSms(phone, body_);

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    initialized: false,
    newlySevere,
    smsSent: result.success,
    smsError: result.error,
  });
}
