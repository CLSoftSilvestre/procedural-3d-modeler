/**
 * Maps the module specifiers a node's codegen declares to import statements (for the
 * exported module) and to runtime-injection info (for the parity harness that executes
 * generated code without a bundler).
 */
export interface ModuleInfo {
  /** ES import statement for the exported module. */
  importStatement: string;
  /** Parameter name when the module is injected as a function argument (parity harness). */
  paramName: string;
  /** Prelude prepended in the harness to bind the names the code uses (e.g. destructuring). */
  evalPrelude?: string;
}

export const MODULES: Record<string, ModuleInfo> = {
  three: {
    importStatement: "import * as THREE from 'three';",
    paramName: 'THREE',
  },
  'three/examples/jsm/utils/BufferGeometryUtils.js': {
    importStatement:
      "import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';",
    paramName: 'BufferGeometryUtils',
  },
  'three-bvh-csg': {
    importStatement:
      "import { ADDITION, Brush, Evaluator, INTERSECTION, SUBTRACTION } from 'three-bvh-csg';",
    paramName: 'CSG',
    evalPrelude: 'const { ADDITION, Brush, Evaluator, INTERSECTION, SUBTRACTION } = CSG;',
  },
};

export function importStatementsFor(specifiers: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const spec of specifiers) {
    const info = MODULES[spec];
    if (info && !seen.has(spec)) {
      seen.add(spec);
      out.push(info.importStatement);
    }
  }
  return out.sort();
}
