"use client";

import { useMemo, useState } from "react";
import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { emberColor, riskColor } from "@/lib/theme";
import { livestockCommodities, severityLabel } from "@/lib/dataUtils";
import { STATE_BY_ABBR } from "@/lib/states";
import type { StateImpact, WildfireStats } from "@/lib/dataUtils";
import type { FlowMeta } from "./SupplyChainFlows";

// Same scale as SupplyChainBuildings' skyline — the two views share a
// terrain and camera, and matching heights keeps the map's visual language
// (and "how big is big") consistent across views instead of every mode
// reinventing its own proportions.
const MIN_BAR_HEIGHT = 30;
const MAX_BAR_HEIGHT = 120;
const SEGMENTS = 3;

// Deterministic per-abbr pseudo-random generator — a state's bar footprint
// stays the same across renders instead of jittering.
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 31) + seed.charCodeAt(i)) >>> 0;
  return () => {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    return (h >>> 8) / 0x1000000;
  };
}

function shadeColor(hex: string, percent: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const mix = (c: number) =>
    percent >= 0
      ? Math.round(c + (255 - c) * percent)
      : Math.round(c * (1 + percent));
  return `#${[mix(r), mix(g), mix(b)].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`;
}

function FlameMarker({
  abbr,
  meta,
  center,
  color,
  markerHeight,
  wildfire,
  impact,
  onSelect,
  isActive,
}: {
  abbr: string;
  meta: FlowMeta;
  center: [number, number];
  color: string;
  markerHeight: number;
  wildfire: WildfireStats;
  impact: StateImpact | undefined;
  onSelect: (abbr: string) => void;
  isActive: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  const livestock = impact ? livestockCommodities(impact) : [];

  // Same footprint approach as SupplyChainBuildings: a fixed pseudo-random
  // width/depth per state, with only height encoding the real data value
  // (avg. annual acres burned) — and the same light-to-dark banding down
  // the bar so it reads as a lit, dimensional object instead of a flat
  // block, matching the Supply Chain Risk view's visual language.
  const rand = useMemo(() => seededRandom(abbr), [abbr]);
  const w = useMemo(() => 9 + rand() * 5, [rand]);
  const d = useMemo(() => 9 + rand() * 5, [rand]);
  const roughness = useMemo(() => 0.35 + rand() * 0.3, [rand]);

  const segmentHeight = markerHeight / SEGMENTS;
  const segments = useMemo(
    () =>
      Array.from({ length: SEGMENTS }, (_, i) => {
        const shadeAmount = 0.18 - (i / (SEGMENTS - 1)) * 0.36;
        return shadeColor(color, shadeAmount);
      }),
    [color]
  );

  return (
    <group
      position={[meta.cx + center[0], meta.height, meta.cz + center[1]]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect(abbr);
      }}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
        setHovered(true);
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
        setHovered(false);
      }}
    >
      {segments.map((segColor, i) => (
        <mesh key={i} position={[0, segmentHeight * i + segmentHeight / 2, 0]} castShadow>
          <boxGeometry args={[w, segmentHeight, d]} />
          <meshStandardMaterial color={segColor} emissive={segColor} emissiveIntensity={0.25} roughness={roughness} />
        </mesh>
      ))}

      {hovered && !isActive && (
        <Html position={[0, markerHeight + 12, 0]} center zIndexRange={[2, 0]}>
          <div
            style={{
              width: 190,
              padding: "8px 10px",
              borderRadius: 8,
              background: "#ffffff",
              border: "1px solid rgba(15,23,42,0.15)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
              pointerEvents: "none",
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
              {STATE_BY_ABBR[abbr]?.name ?? abbr}
            </div>
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: 2 }}>
              {Math.round(wildfire.avgAnnualAcres).toLocaleString()} acres/yr &middot; {wildfire.fireCount} fires
            </div>
            {impact && (
              <div style={{ fontSize: "11px", fontWeight: 700, marginTop: 3, color: riskColor(impact.financialRiskScore) }}>
                Risk {impact.financialRiskScore}/100 &middot; {severityLabel(impact.financialRiskScore)}
              </div>
            )}
            {livestock.length > 0 && (
              <div style={{ fontSize: "10.5px", color: "#0369A1", marginTop: 3 }}>
                {livestock.join(", ")}
              </div>
            )}
            <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: 4 }}>Click for full detail</div>
          </div>
        </Html>
      )}
    </group>
  );
}

/** One extruded bar per state with real wildfire history (NIFC
 * InterAgencyFirePerimeterHistory, 2005-2024) — same banded-tower
 * construction as SupplyChainBuildings, so the Wildfire & Livestock Risk
 * view reads as the same product as the Supply Chain Risk view instead of
 * introducing its own decorative visual language. Height is real average
 * annual acres burned; color is the existing ember/severity ramp. No text
 * or icon sits on the map itself — hovering a bar shows a quick preview
 * card (state name, real acres, fire count, risk score, livestock/poultry
 * exposure) before you click through for the full breakdown of what
 * wildfire in that state actually affects. */
export function WildfireMarkers({
  stats,
  meta,
  center,
  impactByAbbr,
  onSelect,
  activeAbbr,
}: {
  stats: WildfireStats[];
  meta: Map<string, FlowMeta>;
  center: [number, number];
  impactByAbbr: Record<string, StateImpact>;
  onSelect: (abbr: string) => void;
  activeAbbr?: string | null;
}) {
  const maxAcres = useMemo(
    () => Math.max(1, ...stats.map((s) => s.avgAnnualAcres)),
    [stats]
  );

  return (
    <>
      {stats.map((s) => {
        const m = meta.get(s.abbr);
        if (!m || s.avgAnnualAcres <= 0) return null;
        const fraction = s.avgAnnualAcres / maxAcres;
        const color = emberColor(fraction);
        const markerHeight = MIN_BAR_HEIGHT + fraction * (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT);
        return (
          <FlameMarker
            key={s.abbr}
            abbr={s.abbr}
            meta={m}
            center={center}
            color={color}
            markerHeight={markerHeight}
            wildfire={s}
            impact={impactByAbbr[s.abbr]}
            onSelect={onSelect}
            isActive={s.abbr === activeAbbr}
          />
        );
      })}
    </>
  );
}
