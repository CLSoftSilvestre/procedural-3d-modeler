import * as THREE from 'three';

/**
 * ShapeData — a serializable 2D profile (a list of [x, y] points) that flows along
 * 'shape' sockets. Profile-generator nodes (Polygon, Star) produce it; generators
 * (Extrude, Lathe) consume it. The `kind` discriminator distinguishes it at runtime.
 */
export interface ShapeData {
  kind: 'shape';
  points: [number, number][];
  closed: boolean;
}

export function isShapeData(v: unknown): v is ShapeData {
  return typeof v === 'object' && v !== null && (v as { kind?: string }).kind === 'shape';
}

/** Regular n-gon points centered at the origin. */
export function polygonPoints(sides: number, radius: number): [number, number][] {
  const n = Math.max(3, Math.floor(sides));
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([Math.cos(a) * radius, Math.sin(a) * radius]);
  }
  return pts;
}

/** Star points alternating outer/inner radius. */
export function starPoints(count: number, inner: number, outer: number): [number, number][] {
  const c = Math.max(2, Math.floor(count));
  const n = c * 2;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

export function toVector2Array(s: ShapeData): THREE.Vector2[] {
  return s.points.map(([x, y]) => new THREE.Vector2(x, y));
}

/** Build a closed THREE.Shape from the profile (for extrusion). */
export function toThreeShape(s: ShapeData): THREE.Shape {
  return new THREE.Shape(toVector2Array(s));
}
