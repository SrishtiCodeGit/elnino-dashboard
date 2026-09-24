import { NextResponse } from "next/server";
import { Resend } from "resend";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCommodities, getBonds, getElNinoEvents } from "@/lib/data";
import { getLiveStateImpact } from "@/lib/liveImpact";
import { riskColor } from "@/lib/theme";
import { severityLabel } from "@/lib/dataUtils";
import { generateStateReportContent } from "@/lib/aiSummary";
import { ReportDocument } from "@/lib/pdf/ReportDocument";
import { buildCommodityCharts, buildTreasuryChart } from "@/lib/pdf/chartData";
import { getCurrentWeather } from "@/lib/weather";
import { STATE_COORDS } from "@/lib/states";
import type { StateImpact } from "@/lib/dataUtils";
import type { StateReportContent } from "@/lib/aiSummary";
import type { CurrentWeather } from "@/lib/weather";
import type { SparklineSeries } from "@/lib/pdf/chartData";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function renderReportHtml(states: StateImpact[], hasPdf: boolean): string {
  const rows = [...states]
    .sort((a, b) => b.financialRiskScore - a.financialRiskScore)
    .map((s) => {
      const color = riskColor(s.financialRiskScore);
      return `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
            <div style="font-weight:600;font-size:15px;color:#0f172a;">${s.state}</div>
            <div style="font-size:12px;color:#64748b;">${s.region}</div>
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:center;white-space:nowrap;">
            <span style="font-family:ui-monospace,monospace;font-weight:700;font-size:16px;color:${color};">${s.financialRiskScore}</span>
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${color};">${severityLabel(s.financialRiskScore)}</div>
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#334155;line-height:1.5;">
            ${s.climateNote}
            <div style="margin-top:6px;font-size:12px;color:#64748b;">
              Key exposure: ${s.keyCommodities.join(", ") || "&mdash;"} &middot; Commodity: ${s.commodityExposure} &middot; Energy: ${s.energyExposure}
            </div>
          </td>
        </tr>`;
    })
    .join("");

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;">
      <div style="padding:24px 0;border-bottom:2px solid #0f172a;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;">El Nino Financial Risk Dashboard</div>
        <h1 style="font-size:22px;margin:6px 0 0;color:#0f172a;">State Risk Report</h1>
        <div style="font-size:13px;color:#64748b;margin-top:4px;">
          ${states.length} state${states.length === 1 ? "" : "s"} &middot; Generated ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
        </div>
      </div>
      ${
        hasPdf
          ? `<div style="margin:16px 0;padding:12px 16px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;font-size:13px;color:#0c4a6e;">
              &#128206; The attached PDF has an in-depth Claude-generated analysis, live weather, and market charts for each state below.
            </div>`
          : ""
      }
      <table style="width:100%;border-collapse:collapse;margin-top:8px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px 16px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;">State</th>
            <th style="text-align:center;padding:8px 16px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;">Score</th>
            <th style="text-align:left;padding:8px 16px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;">Why</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="padding:20px 16px;font-size:11px;color:#94a3b8;line-height:1.6;">
        Risk scores are a research-project composite: a static research baseline plus a live overlay of NWS severe-weather warnings and the weekly US Drought Monitor &mdash; not an official index. Sent from the El Nino Financial Risk dashboard.
      </div>
    </div>`;
}

export async function POST(request: Request) {
  let body: { abbrs?: unknown; email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const abbrs = Array.isArray(body.abbrs) ? body.abbrs.map((a) => String(a).toUpperCase()) : [];
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (!abbrs.length) {
    return NextResponse.json({ error: "Select at least one state" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const { states: liveStates } = await getLiveStateImpact();
  const selected = liveStates.filter((s) => abbrs.includes(s.abbr));
  if (!selected.length) {
    return NextResponse.json({ error: "No matching states found" }, { status: 404 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!resendKey || !from) {
    return NextResponse.json(
      { error: "Report email isn't configured yet (missing RESEND_API_KEY)" },
      { status: 503 }
    );
  }

  // In-depth, structured per-state analysis (why it matters, commodity /
  // supply-chain / inflation risk, a hedged investment-research outlook)
  // grounded strictly in that state's own data. Falls back to the static
  // climate note in the PDF for any state where generation fails or
  // ANTHROPIC_API_KEY isn't set, so the report is never left blank.
  const contentEntries = await Promise.all(
    selected.map(async (s) => [s.abbr, await generateStateReportContent(s)] as const)
  );
  const content: Record<string, StateReportContent | null> = Object.fromEntries(contentEntries);
  const hasAnyContent = contentEntries.some(([, c]) => c != null);

  // Live weather per state — the same real-time NWS observation the
  // dashboard's own state panel shows, not fabricated or cached.
  const weatherEntries = await Promise.all(
    selected.map(async (s) => {
      const coords = STATE_COORDS[s.abbr];
      const w: CurrentWeather | null = coords ? await getCurrentWeather(coords.lat, coords.lon, coords.city) : null;
      return [s.abbr, w] as const;
    })
  );
  const weather: Record<string, CurrentWeather | null> = Object.fromEntries(weatherEntries);

  // Real historical commodity-futures and Treasury-yield series — same
  // dataset backing the dashboard's own charts, downsampled for the PDF.
  const commoditiesData = getCommodities();
  const bondsData = getBonds();
  const elNinoEvents = getElNinoEvents();
  const commodityCharts: Record<string, SparklineSeries[]> = {};
  for (const s of selected) {
    commodityCharts[s.abbr] = buildCommodityCharts(s, commoditiesData, elNinoEvents);
  }
  const treasuryChart = buildTreasuryChart(bondsData, elNinoEvents);

  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await renderToBuffer(
      ReportDocument({ states: selected, content, weather, commodityCharts, treasuryChart })
    );
  } catch {
    pdfBuffer = null; // Email still sends with the HTML table if PDF generation fails.
  }

  try {
    const resend = new Resend(resendKey);
    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: `El Nino Risk Report — ${selected.length} state${selected.length === 1 ? "" : "s"}`,
      html: renderReportHtml(selected, pdfBuffer != null),
      attachments: pdfBuffer
        ? [{ filename: "el-nino-risk-report.pdf", content: pdfBuffer }]
        : undefined,
    });
    if (error) {
      return NextResponse.json({ error: error.message || "Failed to send report" }, { status: 502 });
    }
    return NextResponse.json({ success: true, pdfAttached: pdfBuffer != null, aiGenerated: hasAnyContent });
  } catch {
    return NextResponse.json({ error: "Failed to send report" }, { status: 502 });
  }
}
