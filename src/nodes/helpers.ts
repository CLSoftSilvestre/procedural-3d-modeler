import type { GeometryData } from '@/geometry/GeometryData';
import { isMaterialSpec, type MaterialSpec } from '@/material/MaterialData';
import type { ResolvedInputs } from './NodeDef';
import type { CodegenContext } from './NodeDef';

/**
 * Typed accessors for resolved node inputs. Inputs may be missing (no edge, no literal,
 * no default), so each takes a fallback. Keeps node `evaluate` bodies terse and safe.
 */
export function num(inputs: ResolvedInputs, key: string, fallback: number): number {
  const v = inputs[key];
  return typeof v === 'number' ? v : fallback;
}

export function bool(inputs: ResolvedInputs, key: string, fallback: boolean): boolean {
  const v = inputs[key];
  return typeof v === 'boolean' ? v : fallback;
}

export function str(inputs: ResolvedInputs, key: string, fallback: string): string {
  const v = inputs[key];
  return typeof v === 'string' ? v : fallback;
}

export function vec3(
  inputs: ResolvedInputs,
  key: string,
  fallback: [number, number, number],
): [number, number, number] {
  const v = inputs[key];
  return Array.isArray(v) && v.length === 3 ? (v as [number, number, number]) : fallback;
}

export function geom(inputs: ResolvedInputs, key = 'geometry'): GeometryData | undefined {
  const v = inputs[key];
  return v && typeof v === 'object' && 'positions' in v ? (v as GeometryData) : undefined;
}

export function mat(inputs: ResolvedInputs, key = 'material'): MaterialSpec | undefined {
  const v = inputs[key];
  return isMaterialSpec(v) ? v : undefined;
}

/** Join several input-socket expressions for a codegen call, in order. */
export function codeArgs(ctx: CodegenContext, socketIds: string[]): string {
  return socketIds.map((id) => ctx.inputExpr(id)).join(', ');
}
