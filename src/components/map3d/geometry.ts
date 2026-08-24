import * as THREE from "three";
import type { Geometry, Position } from "geojson";

/** Converts a (pre-projected, planar) Polygon/MultiPolygon feature geometry
 * into THREE.Shape objects — one per polygon ring-set, with holes for any
 * interior rings (lakes, enclaves). Coordinates are used as-is (already in
 * flat x/y map space from the Albers-USA topojson), y is negated so that
 * north stays "up" once the shape is later stood upright. */
export function geometryToShapes(geometry: Geometry): THREE.Shape[] {
  const shapes: THREE.Shape[] = [];

  const ringsToShape = (rings: Position[][]) => {
    if (!rings.length) return;
    const [outer, ...holes] = rings;
    const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, -y)));
    for (const hole of holes) {
      shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, -y))));
    }
    shapes.push(shape);
  };

  if (geometry.type === "Polygon") {
    ringsToShape(geometry.coordinates as Position[][]);
  } else if (geometry.type === "MultiPolygon") {
    for (const rings of geometry.coordinates as Position[][][]) {
      ringsToShape(rings);
    }
  }

  return shapes;
}
