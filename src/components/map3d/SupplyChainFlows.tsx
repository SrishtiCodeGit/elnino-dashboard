"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { riskColor } from "@/lib/theme";
import { flowRiskInfo } from "@/lib/dataUtils";
import type { StateImpact, SupplyChainFlow } from "@/lib/dataUtils";

const NO_DATA_COLOR = "#475569";
const ARC_BASE_LIFT = 30;

export interface FlowMeta {
  cx: number;
  cz: number;
  height: number;
}

function FlowArc({
  originMeta,
  destMeta,
  center,
  color,
  reducedMotion,
  phase,
  weight,
}: {
  originMeta: FlowMeta;
  destMeta: FlowMeta;
  center: [number, number];
  color: string;
  reducedMotion: boolean;
  phase: number;
  /** 0-1, this flow's dollar value relative to the largest flow shown —
   * drives opacity/width/pulse size so a handful of dominant corridors
   * read clearly and the long tail recedes, instead of 60 equal-weight
   * lines competing for attention. */
  weight: number;
}) {
  const pulseRef = useRef<THREE.Mesh>(null);
  const opacity = 0.22 + weight * 0.63;
  const lineWidth = 0.9 + weight * 2.6;
  const pulseScale = 1.1 + weight * 1.6;

  const { curve, points } = useMemo(() => {
    // Children of the same `<group position={[-center[0], 0, -center[1]]}>`
    // that wraps the state meshes need the RAW (pre-offset) centroid here —
    // meta.cx/cz are already center-subtracted, so re-adding center cancels
    // the group's shift back out. Same fix as the floating state-abbr
    // labels elsewhere in this file.
    const start = new THREE.Vector3(originMeta.cx + center[0], originMeta.height + 3, originMeta.cz + center[1]);
    const end = new THREE.Vector3(destMeta.cx + center[0], destMeta.height + 3, destMeta.cz + center[1]);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    mid.y += ARC_BASE_LIFT + start.distanceTo(end) * 0.09;
    const c = new THREE.QuadraticBezierCurve3(start, mid, end);
    return { curve: c, points: c.getPoints(48) };
  }, [originMeta, destMeta, center]);

  useFrame(({ clock }) => {
    if (reducedMotion || !pulseRef.current) return;
    const t = (clock.elapsedTime * 0.12 + phase) % 1;
    pulseRef.current.position.copy(curve.getPointAt(t));
  });

  return (
    <group>
      <Line points={points} color={color} transparent opacity={opacity} lineWidth={lineWidth} />
      {!reducedMotion && (
        <mesh ref={pulseRef} position={curve.getPointAt(phase)} scale={pulseScale}>
          <sphereGeometry args={[1.6, 8, 8]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

/** Real interstate commodity flow arcs (BTS Freight Analysis Framework),
 * colored by the ORIGIN state's already-computed financial risk score — no
 * new risk model, just a visual read of data this app already has. The
 * terrain itself switches to a distinct blue ramp while this view is
 * active (see UsMap3D.tsx) so these warm risk colors read clearly against
 * it instead of blending into same-hued states. Arc weight scales with the
 * flow's real dollar value so the biggest corridors dominate visually and
 * the long tail recedes, instead of 60 equal-weight lines. */
export function SupplyChainFlows({
  flows,
  meta,
  center,
  impactByAbbr,
}: {
  flows: SupplyChainFlow[];
  meta: Map<string, FlowMeta>;
  center: [number, number];
  impactByAbbr: Record<string, StateImpact>;
}) {
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Weight is normalized WITHIN each commodity's own top-10, not globally —
  // natural gas/crude petroleum dollar values run 5-10x higher than
  // agricultural commodities, so a global max would visually erase every
  // grain/meat flow. This keeps each commodity's own #1 corridor prominent.
  const maxByCommodity = useMemo(() => {
    const max: Record<string, number> = {};
    for (const f of flows) {
      max[f.commodityCode] = Math.max(max[f.commodityCode] ?? 0, f.valueUsdMillions);
    }
    return max;
  }, [flows]);

  return (
    <>
      {flows.map((flow, i) => {
        const originMeta = meta.get(flow.origin);
        const destMeta = meta.get(flow.destination);
        if (!originMeta || !destMeta) return null;
        const info = flowRiskInfo(flow, impactByAbbr);
        const color = info.score != null ? riskColor(info.score) : NO_DATA_COLOR;
        return (
          <FlowArc
            key={`${flow.origin}-${flow.destination}-${flow.commodityCode}`}
            originMeta={originMeta}
            destMeta={destMeta}
            center={center}
            color={color}
            reducedMotion={reducedMotion}
            phase={(i * 0.618) % 1}
            weight={flow.valueUsdMillions / (maxByCommodity[flow.commodityCode] ?? flow.valueUsdMillions)}
          />
        );
      })}
    </>
  );
}
