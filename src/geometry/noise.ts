import { mulberry32 } from './rng';

/**
 * Seeded 3D Perlin (improved) noise. Returns coherent values in roughly [-1, 1].
 * Same seed → same field, so displacement is reproducible across eval and codegen.
 */
export function makeNoise3(seed: number): (x: number, y: number, z: number) => number {
  const perm = new Uint8Array(512);
  const source = new Uint8Array(256);
  for (let i = 0; i < 256; i++) source[i] = i;
  const rng = mulberry32((seed >>> 0) || 1);
  for (let i = 255; i > 0; i--) {
    const r = Math.floor(rng() * (i + 1));
    const t = source[i]!;
    source[i] = source[r]!;
    source[r] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = source[i & 255]!;

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (t: number, a: number, b: number) => a + t * (b - a);
  const grad = (h: number, x: number, y: number, z: number) => {
    const g = h & 15;
    const u = g < 8 ? x : y;
    const v = g < 4 ? y : g === 12 || g === 14 ? x : z;
    return ((g & 1) === 0 ? u : -u) + ((g & 2) === 0 ? v : -v);
  };
  const P = (i: number) => perm[i]!;

  return (x, y, z) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = fade(x);
    const v = fade(y);
    const w = fade(z);
    const A = P(X) + Y;
    const AA = P(A) + Z;
    const AB = P(A + 1) + Z;
    const B = P(X + 1) + Y;
    const BA = P(B) + Z;
    const BB = P(B + 1) + Z;
    return lerp(
      w,
      lerp(
        v,
        lerp(u, grad(P(AA), x, y, z), grad(P(BA), x - 1, y, z)),
        lerp(u, grad(P(AB), x, y - 1, z), grad(P(BB), x - 1, y - 1, z)),
      ),
      lerp(
        v,
        lerp(u, grad(P(AA + 1), x, y, z - 1), grad(P(BA + 1), x - 1, y, z - 1)),
        lerp(u, grad(P(AB + 1), x, y - 1, z - 1), grad(P(BB + 1), x - 1, y - 1, z - 1)),
      ),
    );
  };
}
