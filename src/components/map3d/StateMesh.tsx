"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { geometryToShapes } from "./geometry";
import type { Geometry, Position } from "geojson";

interface Props {
  geometry: Geometry;
  height: number;
  color: string;
  riskScore?: number;
  isHovered: boolean;
  isSelected: boolean;
  isHighlighted?: boolean;
  dimmed?: boolean;
  /** Supply Chain Risk view: severity is shown via buildings, not terrain
   * color, so the terrain shouldn't self-glow either — otherwise dozens of
   * simultaneously-highlighted states each emit a bright emissive surface,
   * and Bloom blows the whole terrain out (washing out the dashed outline
   * along with it). */
  disableGlow?: boolean;
  onPointerEnter: (e: ThreeEvent<PointerEvent>) => void;
  onPointerLeave: () => void;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}

const EXTRUDE_SETTINGS = { depth: 1, bevelEnabled: false, steps: 1 };

function outerRings(geometry: Geometry): Position[][] {
  if (geometry.type === "Polygon") return [geometry.coordinates[0] as Position[]];
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as Position[][][]).map((poly) => poly[0]);
  }
  return [];
}

export function StateMesh({
  geometry,
  height,
  color,
  riskScore,
  isHovered,
  isSelected,
  isHighlighted = false,
  dimmed = false,
  disableGlow = false,
  onPointerEnter,
  onPointerLeave,
  onPointerMove,
  onClick,
}: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  const geom = useMemo(() => {
    const shapes = geometryToShapes(geometry);
    const g = new THREE.ExtrudeGeometry(shapes, EXTRUDE_SETTINGS);
    // Stand the flat (XY-plane) extrusion upright: extrude depth (Z) becomes
    // world "up" (Y), geographic north (Y) becomes world depth (-Z).
    g.rotateX(-Math.PI / 2);
    g.scale(1, height, 1);
    return g;
  }, [geometry, height]);

  // A dashed boundary loop that pulses on hover/select, standing just above
  // the top face — a "target lock" cue on top of the lift/glow feedback.
  // The geometry/material are declared in JSX (like materialRef below) so
  // the per-frame pulse mutates plain refs, not a memoized Three.js object.
  const outlineRings = useMemo(() => outerRings(geometry), [geometry]);
  const outlineMaterialRefs = useRef<(THREE.LineDashedMaterial | null)[]>([]);

  const targetLift = isSelected ? 6 : isHovered ? 3 : isHighlighted ? 4 : 0;
  const targetOpacity = dimmed ? 0.3 : 1;

  // Severe-risk states (75+, the red band) get a continuous breathing glow
  // on top of their normal risk-glow baseline — not just brighter when
  // hovered, but always drawing the eye, since that's the whole point of a
  // risk dashboard: the worst states shouldn't require a mouseover to spot.
  // Phased off the risk score itself so ~10 simultaneous severe states
  // don't all pulse in lockstep.
  const isSevere = riskScore != null && riskScore >= 75;
  const severityPhase = riskScore ?? 0;

  // Risk states glow in their own heatmap color — higher score, hotter glow —
  // so the map reads like a live-monitoring heat display rather than flat-lit
  // blocks. Hover/select boost the same glow instead of swapping in a
  // separate accent color, keeping each state's hue legible while lit up.
  const riskGlow = riskScore != null ? 0.1 + (riskScore / 100) * 0.5 : 0;
  const emissive = color;
  const baseEmissiveIntensity = disableGlow
    ? 0
    : riskGlow + (isSelected ? 0.55 : isHovered ? 0.3 : isHighlighted ? 0.4 : 0);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetLift, 0.18);
    }
    if (materialRef.current) {
      materialRef.current.opacity = THREE.MathUtils.lerp(materialRef.current.opacity, targetOpacity, 0.15);
      if (isSevere && !disableGlow) {
        const pulse = 0.18 + Math.sin(clock.elapsedTime * 1.6 + severityPhase) * 0.18;
        materialRef.current.emissiveIntensity = baseEmissiveIntensity + pulse;
      }
    }
    if (isHovered || isSelected || isHighlighted) {
      const pulse = 0.75 + Math.sin(clock.elapsedTime * 3) * 0.25;
      for (const mat of outlineMaterialRefs.current) {
        if (mat) mat.opacity = pulse;
      }
    }
  });

  const emissiveIntensity = baseEmissiveIntensity;

  return (
    <group ref={groupRef}>
      <mesh
        geometry={geom}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerMove={onPointerMove}
        onClick={onClick}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          ref={materialRef}
          color={color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          roughness={0.65}
          metalness={0.08}
          transparent
          opacity={1}
        />
      </mesh>
      {(isHovered || isSelected || isHighlighted) &&
        outlineRings.map((ring, i) => {
          const pts = ring.map(([x, z]) => new THREE.Vector3(x, height + 0.6, z));
          return (
            <lineLoop key={i}>
              <bufferGeometry
                ref={(g) => {
                  if (!g) return;
                  g.setFromPoints(pts);
                  // Cumulative segment distance for the dash pattern, closing
                  // the loop back to the first point (LineLoop semantics) —
                  // computed here directly since THREE.Line.computeLineDistances()
                  // needs the parent Line instance, which isn't mounted yet
                  // at this point in the r3f commit order.
                  const closed = [...pts, pts[0]];
                  const distances = new Float32Array(pts.length);
                  let d = 0;
                  for (let idx = 1; idx < pts.length; idx++) {
                    d += closed[idx].distanceTo(closed[idx - 1]);
                    distances[idx] = d;
                  }
                  g.setAttribute("lineDistance", new THREE.BufferAttribute(distances, 1));
                }}
              />
              <lineDashedMaterial
                ref={(m) => {
                  outlineMaterialRefs.current[i] = m;
                }}
                color="#0EA5E9"
                dashSize={3.5}
                gapSize={1.5}
                transparent
                opacity={0.9}
              />
            </lineLoop>
          );
        })}
      {/* Permanent black boundary — always visible, not just on hover, so
          every state's shape reads clearly against its neighbors on the
          heatmap regardless of interaction state. */}
      {outlineRings.map((ring, i) => (
        <lineLoop key={`solid-${i}`} position={[0, height + 0.15, 0]}>
          <bufferGeometry
            ref={(g) => {
              if (!g) return;
              g.setFromPoints(ring.map(([x, z]) => new THREE.Vector3(x, 0, z)));
            }}
          />
          <lineBasicMaterial color="#000000" transparent opacity={0.55} />
        </lineLoop>
      ))}
    </group>
  );
}
