"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { geometryToShapes } from "./geometry";
import type { Geometry } from "geojson";

const EXTRUDE_SETTINGS = { depth: 1, bevelEnabled: false, steps: 1 };
const LAND_HEIGHT = 5;
// LandPad's footprint is outset beyond the state's own shape so a strip of
// green land stays visible from directly overhead — otherwise it would sit
// exactly under the state extrusion and be fully hidden from a top-down view.
const OUTSET_SCALE = 1.12;

function outsetShape(shape: THREE.Shape, scale: number): THREE.Shape {
  const points = shape.getPoints();
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const grow = (p: THREE.Vector2) => new THREE.Vector2(cx + (p.x - cx) * scale, cy + (p.y - cy) * scale);

  const outset = new THREE.Shape(points.map(grow));
  for (const hole of shape.holes) {
    outset.holes.push(new THREE.Path(hole.getPoints().map(grow)));
  }
  return outset;
}

/** A thin, real-geography "land" slab beneath a state's risk extrusion —
 * colored like terrain (Google Maps style), so the US reads as land sitting
 * in water rather than blocks floating on an abstract grid. */
export function LandPad({ geometry }: { geometry: Geometry }) {
  const geom = useMemo(() => {
    const shapes = geometryToShapes(geometry).map((s) => outsetShape(s, OUTSET_SCALE));
    const g = new THREE.ExtrudeGeometry(shapes, EXTRUDE_SETTINGS);
    g.rotateX(-Math.PI / 2);
    g.scale(1, LAND_HEIGHT, 1);
    return g;
  }, [geometry]);

  return (
    <mesh geometry={geom} position={[0, -LAND_HEIGHT, 0]} receiveShadow>
      <meshStandardMaterial color="#3D7A45" roughness={0.95} />
    </mesh>
  );
}
