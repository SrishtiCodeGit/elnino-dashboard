import { NextResponse } from "next/server";
import { getLiveStateImpact } from "@/lib/liveImpact";
import { generateStateSummary } from "@/lib/aiSummary";
import { rateLimit } from "@/lib/rateLimit";

export async function GET(
  request: Request,
  { params }: RouteContext<"/api/ai-summary/[abbr]">
) {
  const limited = rateLimit(request, "ai-summary", 30, 10 * 60 * 1000);
  if (limited) return limited;

  const { abbr } = await params;
  const key = abbr.toUpperCase();

  const { states } = await getLiveStateImpact();
  const impact = states.find((s) => s.abbr === key);
  if (!impact) {
    return NextResponse.json({ error: "Unknown state abbreviation" }, { status: 404 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI summary isn't configured yet (missing ANTHROPIC_API_KEY)" },
      { status: 503 }
    );
  }

  const summary = await generateStateSummary(impact);
  if (!summary) {
    return NextResponse.json({ error: "AI summary generation failed" }, { status: 502 });
  }
  return NextResponse.json({ summary, generatedAt: new Date().toISOString() });
}
