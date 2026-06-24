import * as THREE from 'three';
import { makePrimitive } from './factory';
import type { NodeDef } from '../NodeDef';

const seg = (id: string, label: string, def: number, max = 128) => ({
  id,
  label,
  default: def,
  min: 1,
  max,
  step: 1,
  lod: true,
});

/** Polyhedron subdivision level (0 = base solid). Reduced in preview like segment counts. */
const detail = () => ({ id: 'detail', label: 'Detail', default: 0, min: 0, max: 4, step: 1, lod: true });

export const primitiveNodes: NodeDef[] = [
  makePrimitive({
    type: 'primitive.box',
    label: 'Box',
    className: 'BoxGeometry',
    build: (a) => new THREE.BoxGeometry(a[0], a[1], a[2], a[3], a[4], a[5]),
    params: [
      { id: 'width', label: 'Width', default: 1, min: 0.01, max: 10 },
      { id: 'height', label: 'Height', default: 1, min: 0.01, max: 10 },
      { id: 'depth', label: 'Depth', default: 1, min: 0.01, max: 10 },
      seg('widthSegments', 'Width Segments', 1, 32),
      seg('heightSegments', 'Height Segments', 1, 32),
      seg('depthSegments', 'Depth Segments', 1, 32),
    ],
  }),

  makePrimitive({
    type: 'primitive.sphere',
    label: 'Sphere',
    className: 'SphereGeometry',
    build: (a) => new THREE.SphereGeometry(a[0], a[1], a[2]),
    params: [
      { id: 'radius', label: 'Radius', default: 1, min: 0.01, max: 10 },
      seg('widthSegments', 'Width Segments', 32),
      seg('heightSegments', 'Height Segments', 16),
    ],
  }),

  makePrimitive({
    type: 'primitive.cylinder',
    label: 'Cylinder',
    className: 'CylinderGeometry',
    build: (a) => new THREE.CylinderGeometry(a[0], a[1], a[2], a[3], a[4]),
    params: [
      { id: 'radiusTop', label: 'Radius Top', default: 1, min: 0, max: 10 },
      { id: 'radiusBottom', label: 'Radius Bottom', default: 1, min: 0, max: 10 },
      { id: 'height', label: 'Height', default: 2, min: 0.01, max: 10 },
      seg('radialSegments', 'Radial Segments', 32),
      seg('heightSegments', 'Height Segments', 1, 64),
    ],
  }),

  makePrimitive({
    type: 'primitive.cone',
    label: 'Cone',
    className: 'ConeGeometry',
    build: (a) => new THREE.ConeGeometry(a[0], a[1], a[2], a[3]),
    params: [
      { id: 'radius', label: 'Radius', default: 1, min: 0.01, max: 10 },
      { id: 'height', label: 'Height', default: 2, min: 0.01, max: 10 },
      seg('radialSegments', 'Radial Segments', 32),
      seg('heightSegments', 'Height Segments', 1, 64),
    ],
  }),

  makePrimitive({
    type: 'primitive.torus',
    label: 'Torus',
    className: 'TorusGeometry',
    build: (a) => new THREE.TorusGeometry(a[0], a[1], a[2], a[3]),
    params: [
      { id: 'radius', label: 'Radius', default: 1, min: 0.01, max: 10 },
      { id: 'tube', label: 'Tube', default: 0.4, min: 0.01, max: 5 },
      seg('radialSegments', 'Radial Segments', 16),
      seg('tubularSegments', 'Tubular Segments', 48, 256),
    ],
  }),

  makePrimitive({
    type: 'primitive.plane',
    label: 'Plane',
    className: 'PlaneGeometry',
    build: (a) => new THREE.PlaneGeometry(a[0], a[1], a[2], a[3]),
    params: [
      { id: 'width', label: 'Width', default: 1, min: 0.01, max: 10 },
      { id: 'height', label: 'Height', default: 1, min: 0.01, max: 10 },
      seg('widthSegments', 'Width Segments', 1, 64),
      seg('heightSegments', 'Height Segments', 1, 64),
    ],
  }),

  makePrimitive({
    type: 'primitive.capsule',
    label: 'Capsule',
    className: 'CapsuleGeometry',
    build: (a) => new THREE.CapsuleGeometry(a[0], a[1], a[2], a[3]),
    params: [
      { id: 'radius', label: 'Radius', default: 0.5, min: 0.01, max: 10 },
      { id: 'length', label: 'Length', default: 1, min: 0, max: 10 },
      seg('capSegments', 'Cap Segments', 8, 32),
      seg('radialSegments', 'Radial Segments', 16),
    ],
  }),

  makePrimitive({
    type: 'primitive.circle',
    label: 'Circle',
    className: 'CircleGeometry',
    build: (a) => new THREE.CircleGeometry(a[0], a[1]),
    params: [
      { id: 'radius', label: 'Radius', default: 1, min: 0.01, max: 10 },
      seg('segments', 'Segments', 32),
    ],
  }),

  makePrimitive({
    type: 'primitive.ring',
    label: 'Ring',
    className: 'RingGeometry',
    build: (a) => new THREE.RingGeometry(a[0], a[1], a[2], a[3]),
    params: [
      { id: 'innerRadius', label: 'Inner Radius', default: 0.5, min: 0, max: 10 },
      { id: 'outerRadius', label: 'Outer Radius', default: 1, min: 0.01, max: 10 },
      seg('thetaSegments', 'Theta Segments', 32),
      seg('phiSegments', 'Phi Segments', 1, 32),
    ],
  }),

  makePrimitive({
    type: 'primitive.torusKnot',
    label: 'Torus Knot',
    className: 'TorusKnotGeometry',
    build: (a) => new THREE.TorusKnotGeometry(a[0], a[1], a[2], a[3], a[4], a[5]),
    params: [
      { id: 'radius', label: 'Radius', default: 1, min: 0.01, max: 10 },
      { id: 'tube', label: 'Tube', default: 0.3, min: 0.01, max: 5 },
      seg('tubularSegments', 'Tubular Segments', 64, 512),
      seg('radialSegments', 'Radial Segments', 8, 64),
      { id: 'p', label: 'P', default: 2, min: 1, max: 20, step: 1 },
      { id: 'q', label: 'Q', default: 3, min: 1, max: 20, step: 1 },
    ],
  }),

  makePrimitive({
    type: 'primitive.tetrahedron',
    label: 'Tetrahedron',
    className: 'TetrahedronGeometry',
    build: (a) => new THREE.TetrahedronGeometry(a[0], a[1]),
    params: [
      { id: 'radius', label: 'Radius', default: 1, min: 0.01, max: 10 },
      detail(),
    ],
  }),

  makePrimitive({
    type: 'primitive.octahedron',
    label: 'Octahedron',
    className: 'OctahedronGeometry',
    build: (a) => new THREE.OctahedronGeometry(a[0], a[1]),
    params: [
      { id: 'radius', label: 'Radius', default: 1, min: 0.01, max: 10 },
      detail(),
    ],
  }),

  makePrimitive({
    type: 'primitive.dodecahedron',
    label: 'Dodecahedron',
    className: 'DodecahedronGeometry',
    build: (a) => new THREE.DodecahedronGeometry(a[0], a[1]),
    params: [
      { id: 'radius', label: 'Radius', default: 1, min: 0.01, max: 10 },
      detail(),
    ],
  }),

  makePrimitive({
    type: 'primitive.icosahedron',
    label: 'Icosahedron',
    className: 'IcosahedronGeometry',
    build: (a) => new THREE.IcosahedronGeometry(a[0], a[1]),
    params: [
      { id: 'radius', label: 'Radius', default: 1, min: 0.01, max: 10 },
      detail(),
    ],
  }),
];
