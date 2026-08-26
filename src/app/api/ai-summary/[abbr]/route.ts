import { NextResponse } from "next/server";
import { getStateImpact } from "@/lib/data";
import { generateStateSummary } from "@/lib/aiSummary";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/ai-summary/[abbr]">
) {
  const { abbr } = await params;
  const key = abbr.toUpperCase();

  const impact = getStateImpact().find((s) => s.abbr === key);
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
