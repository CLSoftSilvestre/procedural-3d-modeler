import * as THREE from 'three';

/** Procedurally generated with Procedural 3D Modeler. */
export function create_gear() {
  const star1 = [];
  {
    const n = 12 * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? 1 : 0.72;
      star1.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
  }
  const material1 = new ("physical" === 'physical' ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial)({
    color: new THREE.Color("#b08d57"),
    roughness: 0.35,
    metalness: 0.9,
    flatShading: false,
    wireframe: false,
    transparent: 1 < 1,
    opacity: 1,
  });
  const extrudeGeometry1 = new THREE.ExtrudeGeometry(new THREE.Shape(star1), {
    depth: 0.4,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.06,
    bevelSegments: 2,
  });
  extrudeGeometry1.translate(0, 0, -(0.4) / 2);
  extrudeGeometry1.computeVertexNormals();
  extrudeGeometry1.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(0, 0, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(90), THREE.MathUtils.degToRad(0), THREE.MathUtils.degToRad(0))), new THREE.Vector3(1, 1, 1)));
  return new THREE.Mesh(extrudeGeometry1, material1);
}
