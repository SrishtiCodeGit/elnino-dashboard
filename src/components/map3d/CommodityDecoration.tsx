"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Feature, Geometry } from "geojson";
import { STATE_BY_FIPS } from "@/lib/states";
import { seededRandom, largestRing, ringBounds, scatterInRing, clamp } from "./landscapeScatter";

export type DecoratedCommodity = "Cattle" | "Wheat" | "Corn" | "Soybeans";

const WHEAT_STALK_COLORS = ["#D4B36A", "#C9A45C", "#E0C070"];
const WHEAT_LEAF_COLORS = ["#4A7A3E", "#5C8A4A", "#3F6B35"];
const CORN_STALK_COLORS = ["#4A6B3A", "#557A42", "#3F5F35"];
const CORN_TASSEL_COLOR = "#C9A45C";
const CORN_HUSK_COLORS = ["#6B8A44", "#5C7A3A", "#7FA050"];
const CORN_SILK_COLOR = "#B99A64";
const SOY_BUSH_COLORS = ["#3F6B35", "#4A7A3E", "#365E2E", "#517A3E"];
const CATTLE_BODY_COLORS = ["#F0E8D8", "#B08860", "#6B4A32", "#2A2420"];

// A tiled canvas of small gold kernel ellipses, brick-offset row to row —
// stands in for real kernel rows on the ear so it reads as corn up close
// instead of a flat yellow capsule, matching the reference photo's texture.
let sharedKernelTexture: THREE.Texture | null = null;
function getCornKernelTexture(): THREE.Texture {
  if (sharedKernelTexture) return sharedKernelTexture;
  const w = 32;
  const h = 64;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#F0D34A";
  ctx.fillRect(0, 0, w, h);
  const cols = 8;
  const rows = 14;
  const cellW = w / cols;
  const cellH = h / rows;
  for (let r = 0; r < rows; r++) {
    const rowOffset = r % 2 === 0 ? 0 : cellW * 0.5;
    for (let c = 0; c < cols; c++) {
      const cx = (c * cellW + cellW / 2 + rowOffset) % w;
      const cy = r * cellH + cellH / 2;
      ctx.fillStyle = (r + c) % 5 === 0 ? "#D9B93A" : "#F5DE6E";
      ctx.beginPath();
      ctx.ellipse(cx, cy, cellW * 0.42, cellH * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#C9A82E";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  sharedKernelTexture = tex;
  return tex;
}

// A herringbone of alternating gold stripes — stands in for the rows of
// bearded spikelets on a real wheat head, matching the reference photo's
// segmented, bristled look instead of a flat cone.
let sharedWheatTexture: THREE.Texture | null = null;
function getWheatHeadTexture(): THREE.Texture {
  if (sharedWheatTexture) return sharedWheatTexture;
  const w = 24;
  const h = 48;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#E0C070";
  ctx.fillRect(0, 0, w, h);
  const rows = 16;
  const rowH = h / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    ctx.fillStyle = r % 2 === 0 ? "#C9A45C" : "#F0DC8C";
    ctx.beginPath();
    if (r % 2 === 0) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + rowH);
      ctx.lineTo(w, y);
    } else {
      ctx.moveTo(w, y);
      ctx.lineTo(0, y + rowH);
      ctx.lineTo(0, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  sharedWheatTexture = tex;
  return tex;
}

interface ScatteredInstance {
  x: number;
  z: number;
  y: number;
  scale: number;
  colorIdx: number;
  rotY: number;
}

/** Real crop/livestock decoration standing in for the generic city+forest
 * whenever a commodity filter is active — only on the states that state's
 * real `keyCommodities` actually lists as exposed, matching the same
 * highlight set already used to color the terrain. Instanced per part (one
 * draw call each) for the same reason as StateLandscape: dozens of states
 * x dozens of plants would otherwise be dozens of meshes. */
export function CommodityDecoration({
  commodity,
  features,
  meta,
  abbrs,
}: {
  commodity: DecoratedCommodity;
  features: Feature[];
  meta: Map<string, { cx: number; cz: number; height: number }>;
  abbrs: string[];
}) {
  const instances = useMemo(() => {
    const abbrSet = new Set(abbrs);
    const list: ScatteredInstance[] = [];
    const isField = commodity === "Wheat" || commodity === "Corn" || commodity === "Soybeans";
    const divisor = commodity === "Wheat" ? 55 : commodity === "Corn" ? 85 : commodity === "Soybeans" ? 60 : 900;
    const minCount = isField ? 40 : 3;
    const maxCount = isField ? 160 : 12;
    const colorCount =
      commodity === "Wheat"
        ? WHEAT_STALK_COLORS.length
        : commodity === "Corn"
          ? CORN_STALK_COLORS.length
          : commodity === "Soybeans"
            ? SOY_BUSH_COLORS.length
            : CATTLE_BODY_COLORS.length;

    for (const f of features) {
      const fips = String(f.id);
      const ref = STATE_BY_FIPS[fips];
      if (!ref || !abbrSet.has(ref.abbr)) continue;
      const m = meta.get(ref.abbr);
      if (!m) continue;
      const ring = largestRing(f.geometry as Geometry);
      if (!ring) continue;
      const { area } = ringBounds(ring);
      const rand = seededRandom(`${commodity}-${ref.abbr}`);
      const count = clamp(Math.round(area / divisor), minCount, maxCount);
      for (const [x, z] of scatterInRing(ring, count, rand)) {
        list.push({
          x,
          z,
          y: m.height,
          scale: 1 + rand() * 0.8,
          colorIdx: Math.floor(rand() * colorCount),
          rotY: rand() * Math.PI * 2,
        });
      }
    }
    return list;
  }, [commodity, features, meta, abbrs]);

  const partARef = useRef<THREE.InstancedMesh>(null);
  const partBRef = useRef<THREE.InstancedMesh>(null);
  const partCRef = useRef<THREE.InstancedMesh>(null);
  const partDRef = useRef<THREE.InstancedMesh>(null);
  const partERef = useRef<THREE.InstancedMesh>(null);
  const kernelTexture = useMemo(() => getCornKernelTexture(), []);
  const wheatHeadTexture = useMemo(() => getWheatHeadTexture(), []);

  useLayoutEffect(() => {
    const partA = partARef.current;
    const partB = partBRef.current;
    const partC = partCRef.current;
    const partD = partDRef.current;
    const partE = partERef.current;
    if (!partA) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const upAxis = new THREE.Vector3(0, 1, 0);
    const color = new THREE.Color();

    if (commodity === "Wheat") {
      const stalkH = 6.5;
      const headH = 2.4;
      const sideHeadH = 1.6;
      instances.forEach((inst, i) => {
        const h = stalkH * inst.scale;
        m.compose(new THREE.Vector3(inst.x, inst.y + h / 2, inst.z), q, new THREE.Vector3(inst.scale, inst.scale, inst.scale));
        partA.setMatrixAt(i, m);
        partA.setColorAt(i, color.set(WHEAT_STALK_COLORS[inst.colorIdx % WHEAT_STALK_COLORS.length]));

        const topY = inst.y + h;
        // Left uncolored (white multiplies with the herringbone texture
        // as-is) so the canvas-mapped rows read as real gold spikelet tones.
        if (partB) {
          const hh = headH * inst.scale;
          m.compose(new THREE.Vector3(inst.x, topY + hh * 0.5, inst.z), q, new THREE.Vector3(inst.scale, inst.scale, inst.scale));
          partB.setMatrixAt(i, m);
        }

        // Side heads: two shorter spikes fanning outward from the main
        // one — real wheat grows as a clump of several heads per stem
        // cluster, not a single lone spike.
        if (partC) {
          for (let side = 0; side < 2; side++) {
            const tilt = side === 0 ? 0.4 : -0.4;
            const yaw = inst.rotY + (side === 0 ? 0 : 1.9);
            const euler = new THREE.Euler(tilt, yaw, 0, "YXZ");
            q.setFromEuler(euler);
            const sh = sideHeadH * inst.scale;
            m.compose(
              new THREE.Vector3(inst.x, topY - 0.4 * inst.scale + sh * 0.5, inst.z),
              q,
              new THREE.Vector3(inst.scale, inst.scale, inst.scale)
            );
            partC.setMatrixAt(i * 2 + side, m);
          }
          q.identity();
        }

        // Base leaf blades: two curved green blades wrapping the stalk's
        // base — the clump-of-leaves look real wheat has instead of a
        // bare stem, matching the reference photo.
        if (partD) {
          for (let leaf = 0; leaf < 2; leaf++) {
            const tilt = leaf === 0 ? 0.5 : 0.85;
            const yaw = inst.rotY + (leaf === 0 ? 1.1 : -1.7);
            const euler = new THREE.Euler(tilt, yaw, 0, "YXZ");
            q.setFromEuler(euler);
            m.compose(
              new THREE.Vector3(inst.x, inst.y + 1.4 * inst.scale, inst.z),
              q,
              new THREE.Vector3(inst.scale, inst.scale, inst.scale)
            );
            partD.setMatrixAt(i * 2 + leaf, m);
            partD.setColorAt(i * 2 + leaf, color.set(WHEAT_LEAF_COLORS[(inst.colorIdx + leaf) % WHEAT_LEAF_COLORS.length]));
          }
          q.identity();
        }
      });
    } else if (commodity === "Corn") {
      const stalkH = 10.5;
      const tasselH = 1.8;
      instances.forEach((inst, i) => {
        const h = stalkH * inst.scale;
        m.compose(new THREE.Vector3(inst.x, inst.y + h / 2, inst.z), q, new THREE.Vector3(inst.scale, inst.scale, inst.scale));
        partA.setMatrixAt(i, m);
        partA.setColorAt(i, color.set(CORN_STALK_COLORS[inst.colorIdx % CORN_STALK_COLORS.length]));

        // Ear grows from a leaf axil partway up the stalk, offset to the
        // side — not stacked on the tip like a hat, which is what made the
        // first pass read as a lollipop rather than a corn plant.
        const offsetX = Math.cos(inst.rotY) * 0.7 * inst.scale;
        const offsetZ = Math.sin(inst.rotY) * 0.7 * inst.scale;
        const earY = inst.y + h * 0.58;
        q.setFromAxisAngle(upAxis, inst.rotY);
        if (partB) {
          // Left uncolored (white multiplies with the kernel texture as-is)
          // so the canvas-mapped rows read as real gold/amber kernel tones.
          m.compose(
            new THREE.Vector3(inst.x + offsetX, earY, inst.z + offsetZ),
            q,
            new THREE.Vector3(inst.scale, inst.scale, inst.scale)
          );
          partB.setMatrixAt(i, m);
        }
        q.identity();

        // Tassel: a slim cone crowning the top, the actual flower structure
        // real corn has instead of a bare stalk tip.
        if (partC) {
          const th = tasselH * inst.scale;
          m.compose(new THREE.Vector3(inst.x, inst.y + h + th * 0.5, inst.z), q, new THREE.Vector3(inst.scale, inst.scale, inst.scale));
          partC.setMatrixAt(i, m);
          partC.setColorAt(i, color.set(CORN_TASSEL_COLOR));
        }

        // Husk: two leaves peeling back from the ear at different angles —
        // the green-wrapping-gold silhouette that is corn's single most
        // recognizable visual cue, and what a bare capsule was missing.
        if (partD) {
          for (let leaf = 0; leaf < 2; leaf++) {
            const tilt = leaf === 0 ? 0.35 : 1.15;
            const yaw = inst.rotY + (leaf === 0 ? -0.4 : 2.6);
            const euler = new THREE.Euler(tilt, yaw, 0, "YXZ");
            q.setFromEuler(euler);
            m.compose(
              new THREE.Vector3(inst.x + offsetX * 0.6, earY + 0.3 * inst.scale, inst.z + offsetZ * 0.6),
              q,
              new THREE.Vector3(inst.scale, inst.scale, inst.scale)
            );
            partD.setMatrixAt(i * 2 + leaf, m);
            partD.setColorAt(i * 2 + leaf, color.set(CORN_HUSK_COLORS[(inst.colorIdx + leaf) % CORN_HUSK_COLORS.length]));
          }
          q.identity();
        }

        // Silk: a wispy tan tuft at the ear's tip — the small detail that
        // reads as "real corn" in a close photo, not a smooth capsule end.
        if (partE) {
          m.compose(
            new THREE.Vector3(inst.x + offsetX, earY + 1.85 * inst.scale, inst.z + offsetZ),
            q,
            new THREE.Vector3(inst.scale, inst.scale, inst.scale)
          );
          partE.setMatrixAt(i, m);
          partE.setColorAt(i, color.set(CORN_SILK_COLOR));
        }
      });
    } else if (commodity === "Soybeans") {
      // A fuller two-lobe bush — one low broad clump plus a smaller offset
      // clump on top — instead of a single sphere, which read as a rock.
      instances.forEach((inst, i) => {
        const lowerR = 1.5 * inst.scale;
        m.compose(new THREE.Vector3(inst.x, inst.y + lowerR * 0.85, inst.z), q, new THREE.Vector3(inst.scale, inst.scale, inst.scale));
        partA.setMatrixAt(i, m);
        partA.setColorAt(i, color.set(SOY_BUSH_COLORS[inst.colorIdx % SOY_BUSH_COLORS.length]));
        if (partB) {
          const offsetX = Math.cos(inst.rotY) * 0.5 * inst.scale;
          const offsetZ = Math.sin(inst.rotY) * 0.5 * inst.scale;
          m.compose(
            new THREE.Vector3(inst.x + offsetX, inst.y + lowerR * 1.35, inst.z + offsetZ),
            q,
            new THREE.Vector3(inst.scale, inst.scale, inst.scale)
          );
          partB.setMatrixAt(i, m);
          partB.setColorAt(i, color.set(SOY_BUSH_COLORS[(inst.colorIdx + 1) % SOY_BUSH_COLORS.length]));
        }
      });
    } else {
      // Cattle: a low body plus a smaller head offset forward — no legs,
      // just resting close to the ground, which reads fine at map scale.
      instances.forEach((inst, i) => {
        const bodyColor = CATTLE_BODY_COLORS[inst.colorIdx % CATTLE_BODY_COLORS.length];
        m.compose(new THREE.Vector3(inst.x, inst.y + 1.3 * inst.scale, inst.z), q, new THREE.Vector3(inst.scale, inst.scale, inst.scale));
        partA.setMatrixAt(i, m);
        partA.setColorAt(i, color.set(bodyColor));
        if (partB) {
          m.compose(
            new THREE.Vector3(inst.x + 1.6 * inst.scale, inst.y + 1.5 * inst.scale, inst.z + 0.4 * inst.scale),
            q,
            new THREE.Vector3(inst.scale, inst.scale, inst.scale)
          );
          partB.setMatrixAt(i, m);
          partB.setColorAt(i, color.set(bodyColor));
        }
      });
    }

    partA.instanceMatrix.needsUpdate = true;
    if (partA.instanceColor) partA.instanceColor.needsUpdate = true;
    if (partB) {
      partB.instanceMatrix.needsUpdate = true;
      if (partB.instanceColor) partB.instanceColor.needsUpdate = true;
    }
    if (partC) {
      partC.instanceMatrix.needsUpdate = true;
      if (partC.instanceColor) partC.instanceColor.needsUpdate = true;
    }
    if (partD) {
      partD.instanceMatrix.needsUpdate = true;
      if (partD.instanceColor) partD.instanceColor.needsUpdate = true;
    }
    if (partE) {
      partE.instanceMatrix.needsUpdate = true;
      if (partE.instanceColor) partE.instanceColor.needsUpdate = true;
    }
  }, [commodity, instances]);

  if (instances.length === 0) return null;

  if (commodity === "Wheat") {
    return (
      <>
        <instancedMesh ref={partARef} args={[undefined, undefined, instances.length]} castShadow>
          <cylinderGeometry args={[0.24, 0.3, 6.5, 6]} />
          <meshStandardMaterial roughness={0.85} />
        </instancedMesh>
        <instancedMesh ref={partBRef} args={[undefined, undefined, instances.length]} castShadow>
          <coneGeometry args={[0.62, 2.4, 7]} />
          <meshStandardMaterial color="#FFFFFF" map={wheatHeadTexture} roughness={0.7} />
        </instancedMesh>
        <instancedMesh ref={partCRef} args={[undefined, undefined, instances.length * 2]} castShadow>
          <coneGeometry args={[0.42, 1.6, 6]} />
          <meshStandardMaterial color="#FFFFFF" map={wheatHeadTexture} roughness={0.7} />
        </instancedMesh>
        <instancedMesh ref={partDRef} args={[undefined, undefined, instances.length * 2]} castShadow>
          <boxGeometry args={[0.5, 2.6, 0.08]} />
          <meshStandardMaterial roughness={0.75} side={THREE.DoubleSide} />
        </instancedMesh>
      </>
    );
  }

  if (commodity === "Corn") {
    return (
      <>
        <instancedMesh ref={partARef} args={[undefined, undefined, instances.length]} castShadow>
          <cylinderGeometry args={[0.3, 0.4, 10.5, 6]} />
          <meshStandardMaterial roughness={0.8} />
        </instancedMesh>
        <instancedMesh ref={partBRef} args={[undefined, undefined, instances.length]} castShadow>
          <capsuleGeometry args={[0.72, 2.6, 4, 8]} />
          <meshStandardMaterial color="#FFFFFF" map={kernelTexture} roughness={0.55} />
        </instancedMesh>
        <instancedMesh ref={partCRef} args={[undefined, undefined, instances.length]} castShadow>
          <coneGeometry args={[0.32, 1.8, 6]} />
          <meshStandardMaterial roughness={0.8} />
        </instancedMesh>
        <instancedMesh ref={partDRef} args={[undefined, undefined, instances.length * 2]} castShadow>
          <boxGeometry args={[1.3, 3.4, 0.12]} />
          <meshStandardMaterial roughness={0.75} side={THREE.DoubleSide} />
        </instancedMesh>
        <instancedMesh ref={partERef} args={[undefined, undefined, instances.length]} castShadow>
          <coneGeometry args={[0.35, 0.9, 6]} />
          <meshStandardMaterial roughness={0.9} />
        </instancedMesh>
      </>
    );
  }

  if (commodity === "Soybeans") {
    return (
      <>
        <instancedMesh ref={partARef} args={[undefined, undefined, instances.length]} castShadow>
          <sphereGeometry args={[1.5, 8, 7]} />
          <meshStandardMaterial roughness={0.85} />
        </instancedMesh>
        <instancedMesh ref={partBRef} args={[undefined, undefined, instances.length]} castShadow>
          <sphereGeometry args={[1.05, 7, 6]} />
          <meshStandardMaterial roughness={0.85} />
        </instancedMesh>
      </>
    );
  }

  return (
    <>
      <instancedMesh ref={partARef} args={[undefined, undefined, instances.length]} castShadow receiveShadow>
        <sphereGeometry args={[1.5, 8, 6]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={partBRef} args={[undefined, undefined, instances.length]} castShadow>
        <sphereGeometry args={[0.85, 7, 6]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
    </>
  );
}
