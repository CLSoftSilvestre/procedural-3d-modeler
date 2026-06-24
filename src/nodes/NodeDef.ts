import type { GeometryData } from '@/geometry/GeometryData';
import type { LiteralValue, SocketSpec, SocketValue } from '@/graph/types';

/**
 * NodeDef — the plugin contract every node implements.
 *
 * The dual `evaluate` / `codegen` pair is the heart of the system (ADR-002):
 *  - `evaluate` actually performs the operation, feeding the live viewport.
 *  - `codegen` emits three.js code that performs the same operation, for export.
 * A parity test asserts the two produce identical geometry. See ARCHITECTURE.md §5.
 */

/** Resolved inputs passed to evaluate(): socket id -> value (edges resolved, defaults applied). */
export type ResolvedInputs = Record<string, SocketValue | undefined>;

export type EvalQuality = 'preview' | 'full';

export interface EvalContext {
  /** Seeded RNG so randomness is reproducible across eval and codegen. */
  random: () => number;
  /** 'preview' lets nodes cut detail (e.g. segments) for fast viewport feedback while
   *  editing. Always 'full' for export/codegen, so it never affects generated output. */
  quality: EvalQuality;
}

/** A unit of generated code: statements plus the variable holding this node's output. */
export interface CodeFragment {
  /** Lines of code that build the output, referencing upstream output vars. */
  statements: string[];
  /** The variable name that holds this node's result (geometry/value). */
  outputVar: string;
  /** Module specifiers this fragment needs (e.g. 'three'); mapped to imports by the generator. */
  imports?: string[];
  /** Helper ids this fragment needs (e.g. 'noise'); their source is injected by the generator. */
  helpers?: string[];
}

export interface CodegenContext {
  /** Allocate a unique, readable variable name, e.g. uniqueVar('box') -> 'box1'. */
  uniqueVar: (hint: string) => string;
  /** For an input socket: the upstream output var name, or a rendered literal expression. */
  inputExpr: (socketId: string) => string;
  /** The RAW literal value of an input (unquoted) — for inputs that are code, e.g. an
   *  Expression node's formula. Returns undefined if the socket is edge-connected. */
  rawInput: (socketId: string) => LiteralValue | undefined;
}

export interface NodeDef {
  type: string; // e.g. "primitive.box"
  category: string; // "Primitives" | "Modifiers" | "Booleans" | ...
  label: string;
  /** One-line help shown as a tooltip in the palette and a subtitle in the inspector. */
  description?: string;
  inputs: SocketSpec[];
  outputs: SocketSpec[];
  /** Pure: perform the operation for the viewport. */
  evaluate: (inputs: ResolvedInputs, ctx: EvalContext) => GeometryData | SocketValue;
  /** Pure: emit three.js code that performs the same operation. */
  codegen: (ctx: CodegenContext) => CodeFragment;
}
