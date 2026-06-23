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
});

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
];
