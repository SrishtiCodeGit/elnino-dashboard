"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Feature, Geometry } from "geojson";
import { STATE_BY_FIPS } from "@/lib/states";
import { seededRandom, largestRing, ringBounds, scatterInRing, clamp } from "./landscapeScatter";

// A warmer, more varied urban palette — terracotta, warm tan, cool glass
// blue-gray, brick brown — instead of a flat gray-on-gray city.
const BUILDING_COLORS = [
  "#C9A876", "#A8785C", "#8B8680", "#5B7C99",
  "#B4AC9C", "#6B6862", "#9C8567", "#7A8B99",
];
const TREE_FOLIAGE_COLORS = ["#2F5233", "#3A6640", "#26472C", "#456B36", "#3D5C3A", "#2A4F35"];
const TREE_TRUNK_COLORS = ["#5C4033", "#4A3428", "#6B4A38"];

const MIN_BUILDINGS = 8;
const MAX_BUILDINGS = 20;
const MIN_TREES = 15;
const MAX_TREES = 40;

/** A black facade with a grid of window cells (some warm-lit, most dim) —
 * used as an emissiveMap so buildings get a glowing-window look without
 * needing one mesh per window. Repeated vertically so taller buildings get
 * more visible floors instead of one stretched window. */
let sharedWindowTexture: THREE.Texture | null = null;
function getWindowTexture(): THREE.Texture {
  if (sharedWindowTexture) return sharedWindowTexture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size, size);
  const cols = 4;
  const rows = 6;
  const cellW = size / cols;
  const cellH = size / rows;
  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return (seed >>> 8) / 0x1000000;
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rand() > 0.6;
      ctx.fillStyle = lit ? "#FFD98A" : "#242424";
      const padX = cellW * 0.22;
      const padY = cellH * 0.28;
      ctx.fillRect(c * cellW + padX, r * cellH + padY, cellW - padX * 2, cellH - padY * 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 3);
  sharedWindowTexture = tex;
  return tex;
}

interface BuildingInstance {
  x: number;
  z: number;
  y: number;
  w: number;
  d: number;
  h: number;
  colorIdx: number;
}

interface TreeInstance {
  x: number;
  z: number;
  y: number;
  scale: number;
  foliageColorIdx: number;
  trunkColorIdx: number;
}


/** A procedural "city + forest" scattered across every state's real
 * footprint, sitting on top of that state's own risk-height block — pure
 * decoration layered onto the base heatmap view (never shown alongside
 * Supply Chain or Wildfire, which have their own single-landmark markers,
 * or while a state is focused/zoomed-in, which wants a plain uncluttered
 * map). Buildings and trees are each one InstancedMesh (not one mesh per
 * building/tree) — with up to 50 states x ~30 objects each, individual
 * meshes would mean 1,000+ draw calls; instancing keeps it at four. */
export function StateLandscape({
  features,
  meta,
}: {
  features: Feature[];
  meta: Map<string, { cx: number; cz: number; height: number }>;
}) {
  const { buildings, trees } = useMemo(() => {
    const b: BuildingInstance[] = [];
    const t: TreeInstance[] = [];
    for (const f of features) {
      const fips = String(f.id);
      const ref = STATE_BY_FIPS[fips];
      if (!ref) continue;
      const m = meta.get(ref.abbr);
      if (!m) continue;
      const ring = largestRing(f.geometry as Geometry);
      if (!ring) continue;
      const { area } = ringBounds(ring);
      const rand = seededRandom(ref.abbr);

      const buildingCount = clamp(Math.round(area / 550), MIN_BUILDINGS, MAX_BUILDINGS);
      for (const [x, z] of scatterInRing(ring, buildingCount, rand)) {
        b.push({
          x,
          z,
          y: m.height,
          w: 2.5 + rand() * 3,
          d: 2.5 + rand() * 3,
          h: 6 + rand() * 16,
          colorIdx: Math.floor(rand() * BUILDING_COLORS.length),
        });
      }

      const treeCount = clamp(Math.round(area / 220), MIN_TREES, MAX_TREES);
      for (const [x, z] of scatterInRing(ring, treeCount, rand)) {
        t.push({
          x,
          z,
          y: m.height,
          scale: 0.7 + rand() * 0.7,
          foliageColorIdx: Math.floor(rand() * TREE_FOLIAGE_COLORS.length),
          trunkColorIdx: Math.floor(rand() * TREE_TRUNK_COLORS.length),
        });
      }
    }
    return { buildings: b, trees: t };
  }, [features, meta]);

  const buildingRef = useRef<THREE.InstancedMesh>(null);
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const foliageLowerRef = useRef<THREE.InstancedMesh>(null);
  const foliageUpperRef = useRef<THREE.InstancedMesh>(null);
  const windowTexture = useMemo(() => getWindowTexture(), []);

  useLayoutEffect(() => {
    const mesh = buildingRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const color = new THREE.Color();
    buildings.forEach((bld, i) => {
      m.compose(new THREE.Vector3(bld.x, bld.y + bld.h / 2, bld.z), q, new THREE.Vector3(bld.w, bld.h, bld.d));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, color.set(BUILDING_COLORS[bld.colorIdx]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [buildings]);

  // A softer, fuller pine silhouette — two stacked foliage tiers (wide
  // lower, narrow upper, slightly overlapping) instead of one flat cone.
  useLayoutEffect(() => {
    const trunk = trunkRef.current;
    const lower = foliageLowerRef.current;
    const upper = foliageUpperRef.current;
    if (!trunk || !lower || !upper) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const color = new THREE.Color();
    trees.forEach((tr, i) => {
      const trunkH = 3 * tr.scale;
      const lowerH = 5 * tr.scale;
      const upperH = 4 * tr.scale;
      m.compose(new THREE.Vector3(tr.x, tr.y + trunkH / 2, tr.z), q, new THREE.Vector3(tr.scale, tr.scale, tr.scale));
      trunk.setMatrixAt(i, m);
      trunk.setColorAt(i, color.set(TREE_TRUNK_COLORS[tr.trunkColorIdx]));

      const foliageColor = color.set(TREE_FOLIAGE_COLORS[tr.foliageColorIdx]);
      m.compose(
        new THREE.Vector3(tr.x, tr.y + trunkH + lowerH / 2, tr.z),
        q,
        new THREE.Vector3(tr.scale, tr.scale, tr.scale)
      );
      lower.setMatrixAt(i, m);
      lower.setColorAt(i, foliageColor);

      m.compose(
        new THREE.Vector3(tr.x, tr.y + trunkH + lowerH * 0.55 + upperH / 2, tr.z),
        q,
        new THREE.Vector3(tr.scale, tr.scale, tr.scale)
      );
      upper.setMatrixAt(i, m);
      upper.setColorAt(i, foliageColor);
    });
    trunk.instanceMatrix.needsUpdate = true;
    lower.instanceMatrix.needsUpdate = true;
    upper.instanceMatrix.needsUpdate = true;
    if (trunk.instanceColor) trunk.instanceColor.needsUpdate = true;
    if (lower.instanceColor) lower.instanceColor.needsUpdate = true;
    if (upper.instanceColor) upper.instanceColor.needsUpdate = true;
  }, [trees]);

  if (buildings.length === 0 && trees.length === 0) return null;

  return (
    <>
      {buildings.length > 0 && (
        <instancedMesh ref={buildingRef} args={[undefined, undefined, buildings.length]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            roughness={0.6}
            metalness={0.15}
            emissiveMap={windowTexture}
            emissive="#FFFFFF"
            emissiveIntensity={0.55}
            toneMapped={false}
          />
        </instancedMesh>
      )}
      {trees.length > 0 && (
        <>
          <instancedMesh ref={trunkRef} args={[undefined, undefined, trees.length]} castShadow>
            <cylinderGeometry args={[0.4, 0.55, 3, 6]} />
            <meshStandardMaterial roughness={0.9} />
          </instancedMesh>
          <instancedMesh ref={foliageLowerRef} args={[undefined, undefined, trees.length]} castShadow>
            <coneGeometry args={[2.6, 5, 8]} />
            <meshStandardMaterial roughness={0.75} />
          </instancedMesh>
          <instancedMesh ref={foliageUpperRef} args={[undefined, undefined, trees.length]} castShadow>
            <coneGeometry args={[1.7, 4, 8]} />
            <meshStandardMaterial roughness={0.75} />
          </instancedMesh>
        </>
      )}
    </>
  );
}
