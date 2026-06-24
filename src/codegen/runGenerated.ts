import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as CSG from 'three-bvh-csg';
import { MODULES } from './imports';
import type { CodegenResult } from './generate';

const AVAILABLE: Record<string, unknown> = {
  three: THREE,
  'three/examples/jsm/utils/BufferGeometryUtils.js': BufferGeometryUtils,
  'three-bvh-csg': CSG,
};

/**
 * Execute a generated module in-process and return its mesh, without a bundler.
 * Modules the code imports are injected as function arguments; helper sources and any
 * required name-binding preludes are prepended. Used by the parity test harness (and
 * usable later for an in-app "run exported code" preview).
 */
export function runGenerated(
  result: CodegenResult,
  paramOverrides: Record<string, unknown> = {},
  time = 0,
): THREE.Mesh {
  const names: string[] = [];
  const values: unknown[] = [];
  const preludes: string[] = [];

  for (const spec of result.modules) {
    const info = MODULES[spec];
    if (!info) continue;
    if (!names.includes(info.paramName)) {
      names.push(info.paramName);
      values.push(AVAILABLE[spec]);
    }
    if (info.evalPrelude) preludes.push(info.evalPrelude);
  }

  // The generated body references `params` (and `time` when animated); supply both.
  names.push('params', 'time');
  values.push({ ...result.paramDefaults, ...paramOverrides }, time);

  const body = [result.helperSource, preludes.join('\n'), result.functionBody]
    .filter(Boolean)
    .join('\n');

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function(...names, body) as (...args: unknown[]) => THREE.Mesh;
  return fn(...values);
}
