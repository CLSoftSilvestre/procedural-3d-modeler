/**
 * Self-contained helper sources injected into generated code when a node needs them.
 * These must stay behaviourally identical to their runtime counterparts (e.g.
 * `geometry/noise.ts`) — `codegen.helpers.test.ts` guards against drift.
 */

/** Seeded improved-Perlin 3D noise — mirrors geometry/noise.ts (mulberry32 inlined). */
const NOISE_HELPER = `function makeNoise3(seed) {
  const perm = new Uint8Array(512);
  const source = new Uint8Array(256);
  for (let i = 0; i < 256; i++) source[i] = i;
  let a = (seed >>> 0) || 1;
  const rng = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 255; i > 0; i--) {
    const r = Math.floor(rng() * (i + 1));
    const t = source[i]; source[i] = source[r]; source[r] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = source[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (t, a, b) => a + t * (b - a);
  const grad = (h, x, y, z) => {
    const g = h & 15;
    const u = g < 8 ? x : y;
    const v = g < 4 ? y : g === 12 || g === 14 ? x : z;
    return ((g & 1) === 0 ? u : -u) + ((g & 2) === 0 ? v : -v);
  };
  const P = (i) => perm[i];
  return (x, y, z) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = P(X) + Y, AA = P(A) + Z, AB = P(A + 1) + Z;
    const B = P(X + 1) + Y, BA = P(B) + Z, BB = P(B + 1) + Z;
    return lerp(w,
      lerp(v, lerp(u, grad(P(AA), x, y, z), grad(P(BA), x - 1, y, z)),
              lerp(u, grad(P(AB), x, y - 1, z), grad(P(BB), x - 1, y - 1, z))),
      lerp(v, lerp(u, grad(P(AA + 1), x, y, z - 1), grad(P(BA + 1), x - 1, y, z - 1)),
              lerp(u, grad(P(AB + 1), x, y - 1, z - 1), grad(P(BB + 1), x - 1, y - 1, z - 1))));
  };
}`;

export const HELPERS: Record<string, string> = {
  noise: NOISE_HELPER,
};

export function helperSourceFor(ids: Iterable<string>): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const id of ids) {
    if (HELPERS[id] && !seen.has(id)) {
      seen.add(id);
      parts.push(HELPERS[id]!);
    }
  }
  return parts.join('\n\n');
}
