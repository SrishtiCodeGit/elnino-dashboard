// Single source of truth for colors used outside Tailwind classes
// (Canvas/SVG map fills, Recharts series, etc). Mirrors the tokens
// defined in src/app/globals.css — keep both in sync when changing.

export const COLOR = {
  bg: "#05070D",
  surface: "#0A0F1C",
  elevated: "#101827",
  border: "rgba(148,163,184,0.12)",
  borderStrong: "rgba(148,163,184,0.24)",

  textPrimary: "#F1F5F9",
  textSecondary: "#94A3B8",
  textMuted: "#5B6779",

  elNino: "#F87171",
  elNinoStrong: "#EF4444",
  elNinoDeep: "#B91C1C",
  laNina: "#38BDF8",
  laNinaStrong: "#0EA5E9",
  neutral: "#64748B",
  amber: "#F59E0B",
  green: "#34D399",
  violet: "#A78BFA",
} as const;

export const PHASE_COLOR: Record<string, string> = {
  "Super El Nino": "#EF4444",
  "Strong El Nino": "#F87171",
  "Moderate El Nino": "#FB923C",
  "Weak El Nino": "#F59E0B",
  Neutral: "#64748B",
  "La Nina": "#38BDF8",
};

// Risk-score ramp for the state choropleth (0 = low exposure, 100 = high)
// Classic green -> yellow -> red heatmap gradient.
export const RISK_RAMP = [
  "#16A34A", // 0-19   low
  "#84CC16",
  "#EAB308",
  "#F59E0B",
  "#F97316",
  "#EF4444", // 80-100 severe
];

export function riskColor(score: number): string {
  const idx = Math.min(RISK_RAMP.length - 1, Math.floor((score / 100) * RISK_RAMP.length));
  return RISK_RAMP[Math.max(0, idx)];
}

export const COMMODITY_COLOR: Record<string, string> = {
  Wheat: "#F59E0B",
  Corn: "#EAB308",
  Coffee: "#92400E",
  Cocoa: "#7C3AED",
  "Crude Oil": "#38BDF8",
  "Natural Gas": "#34D399",
  Gold: "#FBBF24",
};
