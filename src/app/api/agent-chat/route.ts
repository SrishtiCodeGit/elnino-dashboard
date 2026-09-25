import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getLiveStateImpact, describeLive } from "@/lib/liveImpact";
import { rateLimit } from "@/lib/rateLimit";
import { severityLabel } from "@/lib/dataUtils";
import type { StateImpact } from "@/lib/dataUtils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function buildDatasetContext(states: StateImpact[]): string {
  return [...states]
    .sort((a, b) => b.financialRiskScore - a.financialRiskScore)
    .map(
      (s) =>
        `${s.abbr} ${s.state}: score ${s.financialRiskScore}/100 (${severityLabel(s.financialRiskScore)}), region ${s.region}, commodities [${s.keyCommodities.join(", ") || "none"}], commodity exposure ${s.commodityExposure}, energy exposure ${s.energyExposure}. ${s.climateNote}${describeLive(s) ? ` LIVE: ${describeLive(s)}.` : ""}`
    )
    .join("\n");
}

const SYSTEM_PROMPT = (ctx: string) => `You are the research agent embedded in the El Nino Financial Risk dashboard. You answer questions about US state-level financial risk exposure to El Nino climate conditions, using ONLY the dataset below — never invent a state, score, or fact not present in it. Scores are a static research baseline plus a live overlay (active NWS severe-weather warnings and the weekly US Drought Monitor); lines marked LIVE show the current adjustment. If asked whether it's real-time, explain that only that overlay is live and the baseline is a static research composite.

Dataset (all 51 tracked states, one per line):
${ctx}

Respond to the user's message with ONLY a single JSON object (no markdown fences, no commentary outside it) with exactly these fields:
{
  "reply": "Your natural-language answer. Plain prose, no markdown syntax (no #, **, bullet lists). 1-5 sentences unless the user clearly asked for a longer breakdown.",
  "focusAbbrs": ["XX", "YY"] - the 2-letter abbreviations of the states this reply is actually about, most-relevant first, empty array if the message wasn't about specific states. Used to decide which states an emailed report would cover, so be precise: include only states you actually discussed.
}`;

const MAX_MESSAGE_CHARS = 1000;

export async function POST(request: Request) {
  const limited = rateLimit(request, "agent-chat", 20, 10 * 60 * 1000);
  if (limited) return limited;

  let body: { message?: unknown; history?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: `Message must be ${MAX_MESSAGE_CHARS} characters or fewer` }, { status: 400 });
  }

  const history: ChatMessage[] = Array.isArray(body.history)
    ? body.history.filter(
        (m): m is ChatMessage =>
          m && typeof m === "object" && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
      ).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
    : [];

  const { states } = await getLiveStateImpact();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    const fallbackAbbrs = [...states]
      .sort((a, b) => b.financialRiskScore - a.financialRiskScore)
      .slice(0, 5)
      .map((s) => s.abbr);
    return NextResponse.json({
      reply: "The agent isn't configured yet (missing ANTHROPIC_API_KEY), so I can't answer questions directly — but Email Report will still send today's top risks.",
      focusAbbrs: fallbackAbbrs,
      configured: false,
    });
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const result = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      system: SYSTEM_PROMPT(buildDatasetContext(states)),
      messages: [...history.slice(-8), { role: "user", content: message }],
    });
    const block = result.content[0];
    const raw = block?.type === "text" ? block.text.trim() : "";
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const jsonText = (fenced ? fenced[1] : raw).trim();
    const parsed = JSON.parse(jsonText) as { reply?: unknown; focusAbbrs?: unknown };

    const reply = typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : null;
    if (!reply) throw new Error("Empty reply");

    const validAbbrs = new Set(states.map((s) => s.abbr));
    const focusAbbrs = Array.isArray(parsed.focusAbbrs)
      ? parsed.focusAbbrs.map((a) => String(a).toUpperCase()).filter((a) => validAbbrs.has(a))
      : [];

    return NextResponse.json({ reply, focusAbbrs, configured: true });
  } catch {
    return NextResponse.json({
      reply: "Something went wrong generating that answer. Try rephrasing, or use Email Report to get today's top risks directly.",
      focusAbbrs: [],
      configured: true,
    });
  }
}
