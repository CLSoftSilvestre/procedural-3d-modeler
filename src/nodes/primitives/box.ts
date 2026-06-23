import * as THREE from 'three';
import { fromBufferGeometry } from '@/geometry/GeometryData';
import type { NodeDef, ResolvedInputs } from '../NodeDef';

function num(inputs: ResolvedInputs, key: string, fallback: number): number {
  const v = inputs[key];
  return typeof v === 'number' ? v : fallback;
}

export const boxNode: NodeDef = {
  type: 'primitive.box',
  category: 'Primitives',
  label: 'Box',
  inputs: [
    {
      id: 'width',
      label: 'Width',
      type: 'number',
      default: 1,
      control: { kind: 'slider', min: 0.01, max: 10, step: 0.01 },
    },
    {
      id: 'height',
      label: 'Height',
      type: 'number',
      default: 1,
      control: { kind: 'slider', min: 0.01, max: 10, step: 0.01 },
    },
    {
      id: 'depth',
      label: 'Depth',
      type: 'number',
      default: 1,
      control: { kind: 'slider', min: 0.01, max: 10, step: 0.01 },
    },
    {
      id: 'widthSegments',
      label: 'Width Segments',
      type: 'number',
      default: 1,
      control: { kind: 'slider', min: 1, max: 32, step: 1 },
    },
    {
      id: 'heightSegments',
      label: 'Height Segments',
      type: 'number',
      default: 1,
      control: { kind: 'slider', min: 1, max: 32, step: 1 },
    },
    {
      id: 'depthSegments',
      label: 'Depth Segments',
      type: 'number',
      default: 1,
      control: { kind: 'slider', min: 1, max: 32, step: 1 },
    },
  ],
  outputs: [{ id: 'geometry', label: 'Geometry', type: 'geometry' }],

  evaluate(inputs) {
    const geom = new THREE.BoxGeometry(
      num(inputs, 'width', 1),
      num(inputs, 'height', 1),
      num(inputs, 'depth', 1),
      num(inputs, 'widthSegments', 1),
      num(inputs, 'heightSegments', 1),
      num(inputs, 'depthSegments', 1),
    );
    const data = fromBufferGeometry(geom);
    geom.dispose();
    return data;
  },

  codegen(ctx) {
    const v = ctx.uniqueVar('boxGeometry');
    const args = ['width', 'height', 'depth', 'widthSegments', 'heightSegments', 'depthSegments']
      .map((id) => ctx.inputExpr(id))
      .join(', ');
    return {
      statements: [`const ${v} = new THREE.BoxGeometry(${args});`],
      outputVar: v,
      imports: ['three'],
    };
  },
};
