import * as THREE from 'three';
import { fromBufferGeometry } from '@/geometry/GeometryData';
import type { SocketSpec } from '@/graph/types';
import type { NodeDef } from '../NodeDef';
import { num } from '../helpers';
import { applyTransform, transformInputs, transformStatements } from '../transformShared';

export interface PrimitiveParam {
  id: string;
  label: string;
  default: number;
  min: number;
  max: number;
  step?: number;
  /** Segment-like param: reduced in preview quality for fast viewport feedback. */
  lod?: boolean;
}

export interface PrimitiveConfig {
  type: string;
  label: string;
  description?: string;
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
  // Every primitive can be placed/oriented/scaled on its own — no separate Transform
  // node needed for basic positioning. These live in a collapsible "Transform" group.
  inputs.push(...transformInputs('Transform'));

  return {
    type: config.type,
    category: 'Primitives',
    label: config.label,
    description: config.description ?? `${config.label} primitive.`,
    inputs,
    outputs: [{ id: 'geometry', label: 'Geometry', type: 'geometry' }],

    evaluate(resolved, ctx) {
      const args = config.params.map((p) => {
        const v = num(resolved, p.id, p.default);
        // In preview, drop segment counts for speed (never affects export/codegen).
        return ctx.quality === 'preview' && p.lod ? Math.max(p.min, Math.ceil(v * 0.4)) : v;
      });
      const geom = config.build(args);
      const data = fromBufferGeometry(geom);
      geom.dispose();
      // Apply the primitive's own transform (no-op when left at identity).
      return applyTransform(data, resolved);
    },

    codegen(ctx) {
      const v = ctx.uniqueVar(config.className.replace(/Geometry$/, '').toLowerCase());
      const args = config.params.map((p) => ctx.inputExpr(p.id)).join(', ');
      return {
        statements: [
          `const ${v} = new THREE.${config.className}(${args});`,
          ...transformStatements(ctx, v),
        ],
        outputVar: v,
        imports: ['three'],
      };
    },
  };
}
