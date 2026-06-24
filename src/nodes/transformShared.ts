import * as THREE from 'three';
import { composeMatrix, transformGeometry } from '@/geometry/ops';
import type { GeometryData } from '@/geometry/GeometryData';
import type { SocketSpec } from '@/graph/types';
import type { CodegenContext, ResolvedInputs } from './NodeDef';
import { num } from './helpers';

/**
 * Shared Transform behaviour — used both by the standalone Transform modifier and by
 * the per-primitive transform (so every primitive can be placed without wiring up a
 * separate node). Position/rotation/scale live on socket ids tx/ty/tz, rx/ry/rz
 * (degrees), sx/sy/sz, keeping `evaluate` and `codegen` in lock-step (ADR-002).
 */

interface TransformSocket {
  id: string;
  label: string;
  default: number;
  range: number;
  step: number;
}

const TRANSFORM_SOCKETS: TransformSocket[] = [
  { id: 'tx', label: 'Position X', default: 0, range: 10, step: 0.01 },
  { id: 'ty', label: 'Position Y', default: 0, range: 10, step: 0.01 },
  { id: 'tz', label: 'Position Z', default: 0, range: 10, step: 0.01 },
  { id: 'rx', label: 'Rotation X°', default: 0, range: 180, step: 1 },
  { id: 'ry', label: 'Rotation Y°', default: 0, range: 180, step: 1 },
  { id: 'rz', label: 'Rotation Z°', default: 0, range: 180, step: 1 },
  { id: 'sx', label: 'Scale X', default: 1, range: 5, step: 0.01 },
  { id: 'sy', label: 'Scale Y', default: 1, range: 5, step: 0.01 },
  { id: 'sz', label: 'Scale Z', default: 1, range: 5, step: 0.01 },
];

/** Build the 9 transform input sockets, optionally placed in an inspector group. */
export function transformInputs(group?: string): SocketSpec[] {
  return TRANSFORM_SOCKETS.map((s) => ({
    id: s.id,
    label: s.label,
    type: 'number',
    default: s.default,
    group,
    control: { kind: 'slider', min: -s.range, max: s.range, step: s.step },
  }));
}

/** True if the resolved inputs describe anything other than the identity transform. */
export function hasTransform(inputs: ResolvedInputs): boolean {
  return TRANSFORM_SOCKETS.some((s) => num(inputs, s.id, s.default) !== s.default);
}

/** Apply the transform described by `inputs` to `data` (no-op when identity). */
export function applyTransform(data: GeometryData, inputs: ResolvedInputs): GeometryData {
  if (!hasTransform(inputs)) return data;
  const d2r = THREE.MathUtils.degToRad;
  const matrix = composeMatrix(
    [num(inputs, 'tx', 0), num(inputs, 'ty', 0), num(inputs, 'tz', 0)],
    [d2r(num(inputs, 'rx', 0)), d2r(num(inputs, 'ry', 0)), d2r(num(inputs, 'rz', 0))],
    [num(inputs, 'sx', 1), num(inputs, 'sy', 1), num(inputs, 'sz', 1)],
  );
  return transformGeometry(data, matrix);
}

/** Code for the TRS Matrix4 from the transform sockets. */
export function transformMatrixExpr(ctx: CodegenContext): string {
  const r = (id: string) => `THREE.MathUtils.degToRad(${ctx.inputExpr(id)})`;
  return (
    `new THREE.Matrix4().compose(` +
    `new THREE.Vector3(${ctx.inputExpr('tx')}, ${ctx.inputExpr('ty')}, ${ctx.inputExpr('tz')}), ` +
    `new THREE.Quaternion().setFromEuler(new THREE.Euler(${r('rx')}, ${r('ry')}, ${r('rz')})), ` +
    `new THREE.Vector3(${ctx.inputExpr('sx')}, ${ctx.inputExpr('sy')}, ${ctx.inputExpr('sz')}))`
  );
}

/** True when every transform socket renders to its default literal (so codegen can skip it). */
export function transformIsTrivial(ctx: CodegenContext): boolean {
  return TRANSFORM_SOCKETS.every((s) => ctx.inputExpr(s.id) === String(s.default));
}

/** Statements that apply the transform to `geomVar` in generated code — empty when trivial. */
export function transformStatements(ctx: CodegenContext, geomVar: string): string[] {
  if (transformIsTrivial(ctx)) return [];
  return [`${geomVar}.applyMatrix4(${transformMatrixExpr(ctx)});`];
}
