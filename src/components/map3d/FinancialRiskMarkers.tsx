"use client";

import { useState } from "react";
import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { STATE_BY_ABBR } from "@/lib/states";
import { severityLabel } from "@/lib/dataUtils";
import type { StateImpact } from "@/lib/dataUtils";
import type { FlowMeta } from "./SupplyChainFlows";

// Only the Severe band (score >= 75, same threshold as the heatmap legend
// and the terrain pulse-glow elsewhere) gets a rod — this is meant to draw
// the eye to the states that actually need it, not decorate all 50.
const SEVERE_THRESHOLD = 75;
const MIN_ROD_HEIGHT = 24;
const MAX_ROD_HEIGHT = 84;
const ROD_COLOR = "#DC2626";

function RiskRod({
  abbr,
  meta,
  center,
  score,
  onSelect,
}: {
  abbr: string;
  meta: FlowMeta;
  center: [number, number];
  score: number;
  onSelect: (abbr: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  // Scale within the Severe band itself (75-100), not the full 0-100 range —
  // every rod on screen is already a Severe state, so the height should
  // distinguish "barely severe" from "maximally severe", not get crushed
  // into the top quarter of a 0-100 scale.
  const fraction = Math.min(1, Math.max(0, (score - SEVERE_THRESHOLD) / (100 - SEVERE_THRESHOLD)));
  const rodHeight = MIN_ROD_HEIGHT + fraction * (MAX_ROD_HEIGHT - MIN_ROD_HEIGHT);

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
      <mesh position={[0, rodHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[1.1, 1.6, rodHeight, 8]} />
        <meshStandardMaterial color={ROD_COLOR} emissive={ROD_COLOR} emissiveIntensity={0.45} roughness={0.4} />
      </mesh>

      <Html position={[0, rodHeight + 7, 0]} center zIndexRange={[2, 0]} occlude={false}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: ROD_COLOR,
            border: "2px solid #ffffff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontWeight: 800,
            fontSize: 14,
            fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
            pointerEvents: "none",
            transform: hovered ? "scale(1.15)" : "scale(1)",
            transition: "transform 0.15s ease",
          }}
        >
          $
        </div>
      </Html>

      {hovered && (
        <Html position={[0, rodHeight + 28, 0]} center zIndexRange={[2, 0]}>
          <div
            style={{
              width: 170,
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
            <div style={{ fontSize: "11px", fontWeight: 700, marginTop: 3, color: ROD_COLOR }}>
              Risk {score}/100 &middot; {severityLabel(score)}
            </div>
            <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: 4 }}>Click for full detail</div>
          </div>
        </Html>
      )}
    </group>
  );
}

/** Financial Risk view marker layer: a red rod topped with a $ badge on
 * every Severe-band (score >= 75) state, scaled by how severe within that
 * band. Pairs with the flattened yellow terrain used for this view — color
 * no longer carries severity on the terrain itself, so the worst states
 * need a distinct marker to still read at a glance, same reasoning as the
 * Wildfire/Supply Chain marker layers. */
export function FinancialRiskMarkers({
  states,
  meta,
  center,
  onSelect,
}: {
  states: StateImpact[];
  meta: Map<string, FlowMeta>;
  center: [number, number];
  onSelect: (abbr: string) => void;
}) {
  return (
    <>
      {states.map((s) => {
        if (s.financialRiskScore < SEVERE_THRESHOLD) return null;
        const m = meta.get(s.abbr);
        if (!m) return null;
        return (
          <RiskRod key={s.abbr} abbr={s.abbr} meta={m} center={center} score={s.financialRiskScore} onSelect={onSelect} />
        );
      })}
    </>
  );
}
