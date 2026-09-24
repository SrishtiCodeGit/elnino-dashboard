import { Document, Page, View, Text, StyleSheet, Svg, Path, Rect } from "@react-pdf/renderer";
import { riskColor, RISK_RAMP, COMMODITY_COLOR } from "@/lib/theme";
import { severityLabel } from "@/lib/dataUtils";
import type { StateImpact } from "@/lib/dataUtils";
import type { StateReportContent } from "@/lib/aiSummary";
import type { SparklineSeries } from "@/lib/pdf/chartData";
import type { CurrentWeather } from "@/lib/weather";

const NEUTRAL_CHIP = "#64748B";

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingHorizontal: 40, paddingBottom: 82, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
  kicker: { fontSize: 8, letterSpacing: 1.2, color: "#64748b", textTransform: "uppercase", marginBottom: 4 },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 9, color: "#64748b", marginBottom: 14 },

  legendWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 14,
    borderBottom: "2pt solid #0f172a",
  },
  legendLabel: { fontSize: 7.5, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.6, marginRight: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", marginRight: 12 },
  legendSwatch: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  legendText: { fontSize: 7.5, color: "#475569" },

  stateBlock: { marginBottom: 24 },
  stateHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  stateName: { fontSize: 15, fontWeight: 700 },
  stateRegion: { fontSize: 9, color: "#64748b", marginTop: 1 },
  scoreBlock: { alignItems: "flex-end" },
  score: { fontSize: 18, fontWeight: 700 },
  severityBadge: { borderRadius: 4, paddingVertical: 3, paddingHorizontal: 8, marginTop: 3 },
  severityBadgeText: { fontSize: 7.5, letterSpacing: 0.6, textTransform: "uppercase", color: "#ffffff", fontWeight: 700 },

  progressTrack: { height: 5, backgroundColor: "#e2e8f0", borderRadius: 2.5, marginBottom: 10, overflow: "hidden" },
  progressFill: { height: 5, borderRadius: 2.5 },

  metaLine: { fontSize: 9, color: "#334155", marginBottom: 4, lineHeight: 1.5 },
  metaLabel: { fontWeight: 700, color: "#0f172a" },

  weatherLine: {
    fontSize: 8.5,
    color: "#475569",
    marginBottom: 10,
    lineHeight: 1.5,
    backgroundColor: "#f8fafc",
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  weatherLabel: { fontWeight: 700, color: "#0f172a" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12, marginTop: 2 },
  chip: { borderRadius: 10, borderWidth: 1, paddingVertical: 2.5, paddingHorizontal: 7, marginRight: 5, marginBottom: 5 },
  chipText: { fontSize: 7.5, fontWeight: 700 },

  sectionKicker: { fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8, marginTop: 4 },

  whyBox: { borderLeftWidth: 3, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 12, borderRadius: 2 },
  whyKicker: { fontSize: 7.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 3 },
  whyText: { fontSize: 9.5, lineHeight: 1.55, fontWeight: 700 },

  riskCardRow: { flexDirection: "row", marginBottom: 12 },
  riskCard: { flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 4, padding: 8, marginRight: 8 },
  riskCardLabel: { fontSize: 7, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#475569", marginBottom: 4 },
  riskCardText: { fontSize: 8, lineHeight: 1.45, color: "#334155" },

  chartGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  chartCard: { width: 236, marginRight: 12, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 4, padding: 8 },
  chartHeaderRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  chartTitle: { fontSize: 7.5, fontWeight: 700, color: "#334155" },
  chartValue: { fontSize: 7.5, fontWeight: 700 },
  chartCaption: { fontSize: 6.5, color: "#94a3b8", marginTop: 3 },

  outlookBox: { backgroundColor: "#f0f9ff", borderWidth: 1, borderColor: "#bae6fd", borderRadius: 4, padding: 10, marginBottom: 12 },
  outlookKicker: { fontSize: 7.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, color: "#0c4a6e", marginBottom: 4 },
  outlookText: { fontSize: 9, lineHeight: 1.5, color: "#0c4a6e" },
  outlookDisclaimer: { fontSize: 7, fontStyle: "italic", color: "#64748b", marginTop: 5, lineHeight: 1.4 },

  aiUnavailable: { fontSize: 7.5, color: "#94a3b8", fontStyle: "italic", marginBottom: 8 },

  body: { fontSize: 9.5, lineHeight: 1.6, color: "#334155", textAlign: "justify", marginBottom: 6 },

  sourcesBlock: { marginTop: 10, paddingTop: 8, borderTop: "0.5pt solid #e2e8f0" },
  sourcesLabel: { fontSize: 7.5, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  sourcesText: { fontSize: 7.5, color: "#94a3b8", lineHeight: 1.5 },

  divider: { borderBottom: "1pt solid #e2e8f0", marginTop: 16, marginBottom: 16 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7.5,
    color: "#94a3b8",
    borderTop: "1pt solid #e2e8f0",
    paddingTop: 8,
    lineHeight: 1.5,
  },
});

const SEVERITY_LEGEND: { label: string; color: string }[] = [
  { label: "Low (0-24)", color: RISK_RAMP[0] },
  { label: "Moderate (25-49)", color: RISK_RAMP[2] },
  { label: "High (50-74)", color: RISK_RAMP[4] },
  { label: "Severe (75-100)", color: RISK_RAMP[5] },
];

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <Text style={styles.metaLine}>
      <Text style={styles.metaLabel}>{label}: </Text>
      {value}
    </Text>
  );
}

function buildLinePath(points: number[], width: number, height: number, padding = 3): string {
  if (points.length < 2) return "";
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = (width - padding * 2) / (points.length - 1);
  return points
    .map((p, i) => {
      const x = padding + i * stepX;
      const y = padding + (height - padding * 2) * (1 - (p - min) / range);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildAreaPath(points: number[], width: number, height: number, padding = 3): string {
  const line = buildLinePath(points, width, height, padding);
  if (!line) return "";
  const stepX = (width - padding * 2) / (points.length - 1);
  const lastX = padding + (points.length - 1) * stepX;
  const baseY = height - padding;
  return `${line} L${lastX.toFixed(2)},${baseY.toFixed(2)} L${padding},${baseY.toFixed(2)} Z`;
}

function ChartCard({ series }: { series: SparklineSeries }) {
  const width = 220;
  const height = 62;
  const linePath = buildLinePath(series.points, width, height);
  const areaPath = buildAreaPath(series.points, width, height);
  return (
    <View style={styles.chartCard} wrap={false}>
      <View style={styles.chartHeaderRow}>
        <Text style={styles.chartTitle}>{series.name}</Text>
        <Text style={{ ...styles.chartValue, color: series.color }}>
          {series.unit === "$" ? "$" : ""}
          {series.latestValue.toFixed(2)}
          {series.unit === "%" ? "%" : ""}
        </Text>
      </View>
      <Svg width={width} height={height}>
        {series.elNinoBands.map((b, i) => (
          <Rect
            key={i}
            x={b.startFrac * width}
            y={0}
            width={Math.max(1, (b.endFrac - b.startFrac) * width)}
            height={height}
            fill={hexToRgba("#F87171", 0.16)}
          />
        ))}
        {areaPath && <Path d={areaPath} fill={hexToRgba(series.color, 0.14)} />}
        {linePath && <Path d={linePath} stroke={series.color} strokeWidth={1.4} fill="none" />}
      </Svg>
      <Text style={styles.chartCaption}>25-year history &middot; shaded = El Nino windows</Text>
    </View>
  );
}

function formatWeather(weather: CurrentWeather | null | undefined): string {
  if (!weather || weather.temperatureF == null) {
    return "Live weather unavailable at report generation time.";
  }
  const parts = [`${weather.temperatureF}°F`];
  if (weather.textDescription) parts.push(weather.textDescription);
  if (weather.relativeHumidity != null) parts.push(`${weather.relativeHumidity}% humidity`);
  let line = parts.join(" · ");
  if (weather.observedAt) {
    const observed = new Date(weather.observedAt).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    line += ` — observed ${observed}`;
  }
  return line;
}

export function ReportDocument({
  states,
  content,
  weather,
  commodityCharts,
  treasuryChart,
}: {
  states: StateImpact[];
  content: Record<string, StateReportContent | null>;
  weather: Record<string, CurrentWeather | null>;
  commodityCharts: Record<string, SparklineSeries[]>;
  treasuryChart: SparklineSeries | null;
}) {
  const sorted = [...states].sort((a, b) => b.financialRiskScore - a.financialRiskScore);
  const generatedAt = new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });

  return (
    <Document title="El Nino Financial Risk Report">
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.kicker}>El Nino Financial Risk Dashboard</Text>
        <Text style={styles.title}>State Risk Report</Text>
        <Text style={styles.meta}>
          {sorted.length} state{sorted.length === 1 ? "" : "s"} &middot; Generated {generatedAt}
        </Text>

        <View style={styles.legendWrap}>
          <Text style={styles.legendLabel}>Risk scale</Text>
          {SEVERITY_LEGEND.map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View style={{ ...styles.legendSwatch, backgroundColor: item.color }} />
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>

        {sorted.map((s, i) => {
          const color = riskColor(s.financialRiskScore);
          const c = content[s.abbr];
          const charts = commodityCharts[s.abbr] ?? [];
          return (
            <View key={s.abbr} style={styles.stateBlock}>
              <View wrap={false}>
                <View style={styles.stateHeaderRow}>
                  <View>
                    <Text style={styles.stateName}>
                      {String(i + 1).padStart(2, "0")}. {s.state}
                    </Text>
                    <Text style={styles.stateRegion}>{s.region}</Text>
                  </View>
                  <View style={styles.scoreBlock}>
                    <Text style={{ ...styles.score, color }}>{s.financialRiskScore}/100</Text>
                    <View style={{ ...styles.severityBadge, backgroundColor: color }}>
                      <Text style={styles.severityBadgeText}>{severityLabel(s.financialRiskScore)}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.progressTrack}>
                  <View style={{ ...styles.progressFill, width: `${s.financialRiskScore}%`, backgroundColor: color }} />
                </View>
              </View>

              <MetaLine label="Temp anomaly" value={s.ensoTempAnomaly.replace(/_/g, " ")} />
              <MetaLine label="Precip anomaly" value={s.ensoPrecipAnomaly.replace(/_/g, " ")} />
              <MetaLine label="Commodity exposure" value={s.commodityExposure} />
              <MetaLine label="Energy exposure" value={s.energyExposure} />
              {s.agGdpShare != null && <MetaLine label="Agriculture share of GDP" value={`${s.agGdpShare}%`} />}

              <Text style={styles.weatherLine}>
                <Text style={styles.weatherLabel}>Current Conditions: </Text>
                {formatWeather(weather[s.abbr])}
              </Text>

              {s.keyCommodities.length > 0 && (
                <View style={styles.chipRow}>
                  {s.keyCommodities.map((cm) => {
                    const chipColor = COMMODITY_COLOR[cm] || NEUTRAL_CHIP;
                    return (
                      <View
                        key={cm}
                        style={{ ...styles.chip, borderColor: chipColor, backgroundColor: hexToRgba(chipColor, 0.1) }}
                      >
                        <Text style={{ ...styles.chipText, color: chipColor }}>{cm}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {c ? (
                <>
                  <View
                    wrap={false}
                    style={{
                      ...styles.whyBox,
                      borderLeftColor: color,
                      backgroundColor: hexToRgba(color, 0.08),
                    }}
                  >
                    <Text style={{ ...styles.whyKicker, color }}>Why This Matters</Text>
                    <Text style={styles.whyText}>{c.whyItMatters}</Text>
                  </View>

                  <View style={styles.riskCardRow} wrap={false}>
                    <View style={styles.riskCard}>
                      <Text style={styles.riskCardLabel}>Commodity Risk</Text>
                      <Text style={styles.riskCardText}>{c.commodityRisk}</Text>
                    </View>
                    <View style={styles.riskCard}>
                      <Text style={styles.riskCardLabel}>Supply Chain Risk</Text>
                      <Text style={styles.riskCardText}>{c.supplyChainRisk}</Text>
                    </View>
                    <View style={{ ...styles.riskCard, marginRight: 0 }}>
                      <Text style={styles.riskCardLabel}>Inflation Risk</Text>
                      <Text style={styles.riskCardText}>{c.inflationRisk}</Text>
                    </View>
                  </View>
                </>
              ) : (
                <Text style={styles.aiUnavailable}>
                  In-depth AI analysis unavailable for this state — showing the static research summary below.
                </Text>
              )}

              {(charts.length > 0 || treasuryChart) && (
                <>
                  <Text style={styles.sectionKicker}>Related Market Data</Text>
                  <View style={styles.chartGrid}>
                    {charts.map((series) => (
                      <ChartCard key={series.key} series={series} />
                    ))}
                    {treasuryChart && <ChartCard series={treasuryChart} />}
                  </View>
                </>
              )}

              {c && (
                <View style={styles.outlookBox} wrap={false}>
                  <Text style={styles.outlookKicker}>Investment Outlook</Text>
                  <Text style={styles.outlookText}>{c.investmentOutlook}</Text>
                  <Text style={styles.outlookDisclaimer}>
                    Research consideration only — not personalized financial or investment advice. Consult a
                    licensed financial advisor before making investment decisions.
                  </Text>
                </View>
              )}

              <Text style={styles.sectionKicker}>Full Analysis</Text>
              {(c?.narrative ?? s.climateNote).split("\n\n").map((para, idx) => (
                <Text key={idx} style={styles.body}>
                  {para}
                </Text>
              ))}

              {s.sources.length > 0 && (
                <View style={styles.sourcesBlock} wrap={false}>
                  <Text style={styles.sourcesLabel}>Sources</Text>
                  <Text style={styles.sourcesText}>{s.sources.join("  •  ")}</Text>
                </View>
              )}

              {i < sorted.length - 1 && <View style={styles.divider} />}
            </View>
          );
        })}

        <Text style={styles.footer} fixed>
          Risk scores are a research-project composite (a static research baseline plus live NWS severe-weather
          warnings and the weekly US Drought Monitor), not an official index. Commodity and treasury charts reflect historical market data, not live pricing. This report
          is a research tool, not personalized financial or investment advice. Generated from the El Nino
          Financial Risk dashboard.
        </Text>
      </Page>
    </Document>
  );
}
