import * as THREE from 'three';
import { ADDITION, Brush, Evaluator, INTERSECTION, SUBTRACTION } from 'three-bvh-csg';

/** Procedurally generated with Procedural 3D Modeler. */
export function create_cored_cube() {
  const box1 = new THREE.BoxGeometry(1.6, 1.6, 1.6, 1, 1, 1);
  const sphere1 = new THREE.SphereGeometry(1.05, 32, 24);
  const material1 = new ("standard" === 'physical' ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial)({
    color: new THREE.Color("#5b8bd0"),
    roughness: 0.4,
    metalness: 0.1,
    flatShading: false,
    wireframe: false,
    transparent: 1 < 1,
    opacity: 1,
  });
  const booleanResult1_ev = new Evaluator();
  booleanResult1_ev.useGroups = false;
  const booleanResult1_a = new Brush(box1);
  const booleanResult1_b = new Brush(sphere1);
  booleanResult1_a.updateMatrixWorld();
  booleanResult1_b.updateMatrixWorld();
  const booleanResult1 = booleanResult1_ev.evaluate(booleanResult1_a, booleanResult1_b, { union: ADDITION, subtract: SUBTRACTION, intersect: INTERSECTION }["subtract"]).geometry;
  return new THREE.Mesh(booleanResult1, material1);
}
