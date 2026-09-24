import { NextResponse } from "next/server";
import { getLiveStateImpact, describeLive } from "@/lib/liveImpact";
import { severityLabel } from "@/lib/dataUtils";
import { sendSms } from "@/lib/sms";
import { normalizePhone, isValidPhone } from "@/lib/phone";

// Scores here are the live-adjusted ones (static baseline + NWS alerts +
// Drought Monitor), so a real check can now find a genuine change.
// Server-process-lifetime snapshot of which states were Severe (score >= 75)
// as of the last check — same single-instance-cache pattern already used in
// aiSummary.ts. Lets the monitor detect a state *newly* crossing into
// Severe instead of re-alerting on every poll. Resets on server restart; a
// multi-instance production deployment would need a shared store instead.
let lastSevere: Set<string> | null = null;

export async function POST(request: Request) {
  let body: { phone?: unknown; simulate?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  // Normalized server-side too (not just trusting the client) — someone
  // could call this route directly, and "+1 555 010 0123" is a completely
  // normal way to type a number that a bare E.164 regex would reject.
  const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";
  const simulate = body.simulate === true;

  const { states } = await getLiveStateImpact();

  // Test-only path: real crossings depend on live weather/drought, which
  // may not produce one for days. This exercises the exact same SMS-send + response
  // shape as a real detection, using a real state (the one genuinely
  // closest to Severe) rather than inventing one — it just doesn't touch
  // `lastSevere`, so it can't corrupt real monitoring's baseline.
  if (simulate) {
    const closest = [...states]
      .filter((s) => s.financialRiskScore < 75)
      .sort((a, b) => b.financialRiskScore - a.financialRiskScore)[0];
    if (!closest) {
      return NextResponse.json({ checkedAt: new Date().toISOString(), initialized: false, newlySevere: [], smsSent: false });
    }
    const simulatedEntry = {
      abbr: closest.abbr,
      state: closest.state,
      score: closest.financialRiskScore,
      severity: severityLabel(closest.financialRiskScore),
    };
    if (!phone || !isValidPhone(phone)) {
      return NextResponse.json({
        checkedAt: new Date().toISOString(),
        initialized: false,
        newlySevere: [simulatedEntry],
        simulated: true,
        smsSent: false,
        smsError: !phone ? "No phone number registered" : "Phone number must be in +1XXXXXXXXXX (E.164) format",
      });
    }
    const testBody = `El Nino Risk Alert (TEST): simulated Severe crossing for ${closest.state} (${closest.financialRiskScore}/100). This is a test of the alert pipeline, not a real risk change.`;
    const result = await sendSms(phone, testBody);
    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      initialized: false,
      newlySevere: [simulatedEntry],
      simulated: true,
      smsSent: result.success,
      smsError: result.error,
    });
  }

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
    .map((s) => ({
      abbr: s.abbr,
      state: s.state,
      score: s.financialRiskScore,
      severity: severityLabel(s.financialRiskScore),
      driver: describeLive(s),
    }));

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

  const list = newlySevere
    .map((s) => `${s.state} (${s.score}/100${s.driver ? `; ${s.driver}` : ""})`)
    .join(", ");
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
