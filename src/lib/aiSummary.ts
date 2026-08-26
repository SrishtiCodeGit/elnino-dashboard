import Anthropic from "@anthropic-ai/sdk";
import type { StateImpact } from "./dataUtils";

// The underlying state data is static (the research composite dataset), so
// a summary only ever needs to be generated once per server process, not
// on every request — this cache turns what could be many LLM calls into at
// most one per state per kind, for the lifetime of the process. Resets on
// restart; fine for a single-instance project. A multi-instance production
// deployment would need a shared cache (Redis, etc.) instead.
const shortCache = new Map<string, string>();
const reportCache = new Map<string, StateReportContent>();

function buildContext(impact: StateImpact): string {
  return `State: ${impact.state} (${impact.region})
Financial Risk Score: ${impact.financialRiskScore}/100
Temperature Anomaly: ${impact.ensoTempAnomaly.replace(/_/g, " ")}
Precipitation Anomaly: ${impact.ensoPrecipAnomaly.replace(/_/g, " ")}
Climate Note: ${impact.climateNote}
Key Commodities: ${impact.keyCommodities.join(", ") || "none tracked"}
Commodity Exposure: ${impact.commodityExposure}
Energy Exposure: ${impact.energyExposure}${
    impact.agGdpShare != null ? `\nAgriculture Share of GDP: ${impact.agGdpShare}%` : ""
  }
Sources: ${impact.sources.join("; ") || "none listed"}`;
}

const NO_MARKDOWN_RULE =
  "Never use Markdown syntax anywhere in your output — no '#' or '##' headings, no numbered or bulleted lists, no '**bold**' markers. Plain prose sentences only.";

const SHORT_PROMPT = (ctx: string) => `You are a financial risk analyst. Write a concise 2-3 sentence summary connecting this US state's El Nino climate signal to its financial and economic risk exposure. Use ONLY the facts listed below — do not invent additional statistics, events, or data not given here. ${NO_MARKDOWN_RULE} Professional and neutral in tone.

${ctx}`;

export interface StateReportContent {
  whyItMatters: string;
  commodityRisk: string;
  supplyChainRisk: string;
  inflationRisk: string;
  investmentOutlook: string;
  narrative: string;
}

const REPORT_FIELDS: (keyof StateReportContent)[] = [
  "whyItMatters",
  "commodityRisk",
  "supplyChainRisk",
  "inflationRisk",
  "investmentOutlook",
  "narrative",
];

const REPORT_JSON_PROMPT = (ctx: string) => `You are a senior financial risk analyst preparing a structured briefing section for a research report. Using ONLY the facts listed below — do not invent additional statistics, events, sources, or data not given here — respond with ONLY a single JSON object (no markdown code fences, no commentary before or after it) with exactly these six string fields:

{
  "whyItMatters": "2-3 sentences. Open with a direct one-sentence verdict on WHY this state's score lands where it does — e.g. 'This state's exposure is elevated because...' or 'This state's exposure is comparatively contained because...' — then briefly explain.",
  "commodityRisk": "2-3 sentences on commodity price and production risk specific to this state's tracked commodities and its commodity exposure level.",
  "supplyChainRisk": "2-3 sentences reasoning about how this climate anomaly could plausibly affect regional supply chains — production timing, transport, logistics — for this state's sectors. This is inference from known cause-and-effect mechanisms, not a direct dataset field, so use hedged language ('could', 'may', 'tends to').",
  "inflationRisk": "2-3 sentences reasoning about potential price-level pass-through from this state's commodity and energy exposure. Hedged language, no invented CPI figures or percentages.",
  "investmentOutlook": "2-3 sentences of qualitative, hedged considerations for someone researching financial exposure to this state's economy or sectors. This must read as a research consideration, not a personalized recommendation — do not tell the reader what to do with their own money.",
  "narrative": "2 to 3 paragraphs (joined with a single \\n\\n) giving a fuller analyst narrative connecting the climate signal, sector exposure, and score context. Plain prose, no headers, no lists."
}

Every field must be valid JSON string content. ${NO_MARKDOWN_RULE} Professional, neutral, analyst tone throughout.

${ctx}`;

function stripMarkdownArtifacts(text: string): string {
  return text
    .replace(/^#{1,6}\s+.*$/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : raw).trim();
}

function parseReportContent(raw: string): StateReportContent | null {
  try {
    const obj = JSON.parse(extractJson(raw));
    const result = {} as StateReportContent;
    for (const field of REPORT_FIELDS) {
      const value = obj[field];
      if (typeof value !== "string" || !value.trim()) return null;
      result[field] = stripMarkdownArtifacts(value);
    }
    return result;
  } catch {
    return null;
  }
}

/** Generates (and caches) the short 2-3 sentence AI summary used by the
 * per-state widget. Returns null if no API key is configured or generation
 * fails — callers decide the fallback, this never throws. */
export async function generateStateSummary(impact: StateImpact): Promise<string | null> {
  const cached = shortCache.get(impact.abbr);
  if (cached) return cached;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 220,
      messages: [{ role: "user", content: SHORT_PROMPT(buildContext(impact)) }],
    });
    const block = message.content[0];
    const raw = block?.type === "text" ? block.text.trim() : "";
    if (!raw) return null;
    const text = stripMarkdownArtifacts(raw);
    if (!text) return null;
    shortCache.set(impact.abbr, text);
    return text;
  } catch {
    return null;
  }
}

/** Generates (and caches) the structured, in-depth briefing content used in
 * the PDF report: why the score is what it is, commodity / supply-chain /
 * inflation risk, a hedged investment-research outlook, and a fuller
 * narrative. Returns null if no API key is configured or generation fails —
 * callers fall back to the state's static climate note. */
export async function generateStateReportContent(
  impact: StateImpact
): Promise<StateReportContent | null> {
  const cached = reportCache.get(impact.abbr);
  if (cached) return cached;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1600,
      messages: [{ role: "user", content: REPORT_JSON_PROMPT(buildContext(impact)) }],
    });
    const block = message.content[0];
    const raw = block?.type === "text" ? block.text.trim() : "";
    if (!raw) return null;
    const content = parseReportContent(raw);
    if (!content) return null;
    reportCache.set(impact.abbr, content);
    return content;
  } catch {
    return null;
  }
}
