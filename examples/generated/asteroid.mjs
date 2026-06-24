import * as THREE from 'three';

function makeNoise3(seed) {
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
}

/** Procedurally generated with Procedural 3D Modeler. */
export function create_asteroid() {
  const sphere1 = new THREE.SphereGeometry(1, 48, 32);
  const material1 = new ("standard" === 'physical' ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial)({
    color: new THREE.Color("#8a7f73"),
    roughness: 0.95,
    metalness: 0,
    flatShading: false,
    wireframe: false,
    transparent: 1 < 1,
    opacity: 1,
  });
  {
    const noise1 = makeNoise3(7);
    const pos = sphere1.attributes.position;
    const nrm = sphere1.attributes.normal;
    const f = 1.6, s = 0.35;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const d = s * noise1(x * f, y * f, z * f);
      pos.setXYZ(i, x + nrm.getX(i) * d, y + nrm.getY(i) * d, z + nrm.getZ(i) * d);
    }
    pos.needsUpdate = true;
  }
  sphere1.computeVertexNormals();
  return new THREE.Mesh(sphere1, material1);
}
