"use client";

import { useMemo } from "react";
import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { riskColor } from "@/lib/theme";
import type { StateImpact, SupplyChainFlow } from "@/lib/dataUtils";
import type { FlowMeta } from "./SupplyChainFlows";

const NO_DATA_COLOR = "#475569";
// State extrusions top out around 46 world units (MAX_HEIGHT in
// UsMap3D.tsx) and states themselves span tens to 100+ units wide — the
// first version of these buildings used a 1-2 unit footprint and was
// essentially invisible at map scale. Sized here to actually read as
// landmarks: taller than the terrain itself, wide enough to see from the
// default camera distance.
const MIN_SKYLINE_HEIGHT = 34;
const MAX_SKYLINE_HEIGHT = 135;
const SEGMENTS = 3;

// Deterministic per-abbr pseudo-random generator — the skyline shape for a
// given state stays the same across renders instead of jittering.
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

function Building({
  abbr,
  meta,
  center,
  color,
  heightScale,
  onSelect,
}: {
  abbr: string;
  meta: FlowMeta;
  center: [number, number];
  color: string;
  heightScale: number;
  onSelect: (abbr: string) => void;
}) {
  // One building per state, not a cluster — a cluster of 3-4 boxes per
  // state read as noise once dozens of states were involved. A single,
  // clearly-sized tower per state is easier to scan at a glance.
  const rand = useMemo(() => seededRandom(abbr), [abbr]);
  const w = useMemo(() => 10 + rand() * 6, [rand]);
  const d = useMemo(() => 10 + rand() * 6, [rand]);
  const roughness = useMemo(() => 0.35 + rand() * 0.3, [rand]);

  // A light-to-dark banding down the tower (top brighter, base darker) —
  // reads as a lit facade with some dimension instead of one flat block.
  const segmentHeight = heightScale / SEGMENTS;
  const segments = useMemo(
    () =>
      Array.from({ length: SEGMENTS }, (_, i) => {
        const shadeAmount = 0.22 - (i / (SEGMENTS - 1)) * 0.4; // top: +0.22, base: -0.18
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
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      {segments.map((segColor, i) => (
        <mesh key={i} position={[0, segmentHeight * i + segmentHeight / 2, 0]} castShadow>
          <boxGeometry args={[w, segmentHeight, d]} />
          <meshStandardMaterial color={segColor} emissive={segColor} emissiveIntensity={0.3} roughness={roughness} />
        </mesh>
      ))}
      <Html position={[0, -2.5, 0]} center zIndexRange={[1, 0]}>
        <div
          style={{
            padding: "1.5px 5px",
            borderRadius: 3,
            background: "#ffffff",
            border: "1px solid rgba(15,23,42,0.25)",
            fontFamily: "ui-monospace, monospace",
            fontSize: "10px",
            fontWeight: 700,
            color: "#10151c",
            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {abbr}
        </div>
      </Html>
    </group>
  );
}

/** A single procedural building at every state touched by a supply chain
 * flow — a literal building marker for that state's supplier/consumer
 * role, standing in place of a modeled 3D asset (out of scope for this
 * project). Height reflects the real total dollar value of flows in/out of
 * that state; color reuses the same risk-color scale as everywhere else in
 * the app, since the terrain itself goes flat/neutral in this view.
 * Clicking a building calls `onSelect` with that state's abbreviation
 * instead of the normal state-detail flow — the caller is expected to show
 * supply-chain-specific impact (dollar value, why) rather than the general
 * state panel. */
export function SupplyChainBuildings({
  flows,
  meta,
  center,
  impactByAbbr,
  onSelect,
}: {
  flows: SupplyChainFlow[];
  meta: Map<string, FlowMeta>;
  center: [number, number];
  impactByAbbr: Record<string, StateImpact>;
  onSelect: (abbr: string) => void;
}) {
  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of flows) {
      map.set(f.origin, (map.get(f.origin) ?? 0) + f.valueUsdMillions);
      map.set(f.destination, (map.get(f.destination) ?? 0) + f.valueUsdMillions);
    }
    return map;
  }, [flows]);

  const maxTotal = useMemo(() => Math.max(1, ...Array.from(totals.values())), [totals]);

  return (
    <>
      {[...totals.entries()].map(([abbr, total]) => {
        const m = meta.get(abbr);
        if (!m) return null;
        const impact = impactByAbbr[abbr];
        const color = impact ? riskColor(impact.financialRiskScore) : NO_DATA_COLOR;
        const heightScale = MIN_SKYLINE_HEIGHT + (total / maxTotal) * (MAX_SKYLINE_HEIGHT - MIN_SKYLINE_HEIGHT);
        return (
          <Building
            key={abbr}
            abbr={abbr}
            meta={m}
            center={center}
            color={color}
            heightScale={heightScale}
            onSelect={onSelect}
          />
        );
      })}
    </>
  );
}
