import type { Geometry, Position } from "geojson";

/** Shared point-scattering helpers for anything that needs to place
 * decorative instances (buildings, trees, crops, livestock) within a
 * state's real polygon footprint — used by StateLandscape and
 * CommodityDecoration so both draw from the same real geography instead of
 * approximating with a bounding box or centroid. */

export function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 31) + seed.charCodeAt(i)) >>> 0;
  return () => {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    return (h >>> 8) / 0x1000000;
  };
}

// Largest ring by bounding-box area — decorative scatter only needs the
// state's main landmass, not every small island/exclave in a MultiPolygon.
export function largestRing(geometry: Geometry): Position[] | null {
  const rings: Position[][] =
    geometry.type === "Polygon"
      ? [geometry.coordinates[0] as Position[]]
      : geometry.type === "MultiPolygon"
        ? (geometry.coordinates as Position[][][]).map((poly) => poly[0])
        : [];
  if (rings.length === 0) return null;
  let best: Position[] | null = null;
  let bestArea = -Infinity;
  for (const ring of rings) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const area = (maxX - minX) * (maxZ - minZ);
    if (area > bestArea) {
      bestArea = area;
      best = ring;
    }
  }
  return best;
}

export function ringBounds(ring: Position[]) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minX, maxX, minZ, maxZ, area: (maxX - minX) * (maxZ - minZ) };
}

// Standard ray-casting point-in-polygon test.
export function pointInRing(x: number, z: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    const intersect = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function scatterInRing(ring: Position[], count: number, rand: () => number): [number, number][] {
  const { minX, maxX, minZ, maxZ } = ringBounds(ring);
  const points: [number, number][] = [];
  let attempts = 0;
  while (points.length < count && attempts < count * 50) {
    attempts++;
    const x = minX + rand() * (maxX - minX);
    const z = minZ + rand() * (maxZ - minZ);
    if (pointInRing(x, z, ring)) points.push([x, z]);
  }
  return points;
}

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
