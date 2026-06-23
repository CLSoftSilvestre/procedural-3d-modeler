import * as THREE from 'three';
import { fromBufferGeometry } from '@/geometry/GeometryData';
import type { SocketSpec } from '@/graph/types';
import type { NodeDef } from '../NodeDef';
import { num } from '../helpers';

export interface PrimitiveParam {
  id: string;
  label: string;
  default: number;
  min: number;
  max: number;
  step?: number;
}

export interface PrimitiveConfig {
  type: string;
  label: string;
  /** three.js class name for codegen, e.g. "SphereGeometry". */
  className: string;
  /** Build the geometry from ordered numeric args. */
  build: (args: number[]) => THREE.BufferGeometry;
  params: PrimitiveParam[];
}

/**
 * Build a primitive NodeDef from a config. Every primitive is "construct a
 * BufferGeometry from ordered numeric params", so they share one implementation for
 * both `evaluate` and `codegen`, keeping them in lock-step by construction.
 */
export function makePrimitive(config: PrimitiveConfig): NodeDef {
  const inputs: SocketSpec[] = config.params.map((p) => ({
    id: p.id,
    label: p.label,
    type: 'number',
    default: p.default,
    control: { kind: 'slider', min: p.min, max: p.max, step: p.step ?? 0.01 },
  }));

  return {
    type: config.type,
    category: 'Primitives',
    label: config.label,
    inputs,
    outputs: [{ id: 'geometry', label: 'Geometry', type: 'geometry' }],

    evaluate(resolved) {
      const args = config.params.map((p) => num(resolved, p.id, p.default));
      const geom = config.build(args);
      const data = fromBufferGeometry(geom);
      geom.dispose();
      return data;
    },

    codegen(ctx) {
      const v = ctx.uniqueVar(config.className.replace(/Geometry$/, '').toLowerCase());
      const args = config.params.map((p) => ctx.inputExpr(p.id)).join(', ');
      return {
        statements: [`const ${v} = new THREE.${config.className}(${args});`],
        outputVar: v,
        imports: ['three'],
      };
    },
  };
}
