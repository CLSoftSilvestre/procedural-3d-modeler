import { ADDITION, Brush, Evaluator, INTERSECTION, SUBTRACTION } from 'three-bvh-csg';
import { fromBufferGeometry, toBufferGeometry, type GeometryData } from './GeometryData';

export type BooleanOp = 'union' | 'subtract' | 'intersect';

const OP = { union: ADDITION, subtract: SUBTRACTION, intersect: INTERSECTION } as const;

// Single shared evaluator. Groups off — we produce a single merged geometry.
const evaluator = new Evaluator();
evaluator.useGroups = false;

/**
 * Mesh boolean via three-bvh-csg. Both inputs must carry matching attributes
 * (our geometries all have position/normal/uv). Degenerate inputs are handled so the
 * operation never throws on an empty operand.
 */
export function booleanOp(a: GeometryData, b: GeometryData, op: BooleanOp): GeometryData {
  const aEmpty = a.metadata.triCount === 0;
  const bEmpty = b.metadata.triCount === 0;
  if (aEmpty || bEmpty) {
    // union: whichever exists; subtract: a unchanged; intersect: nothing.
    if (op === 'union') return aEmpty ? b : a;
    if (op === 'subtract') return a;
    return aEmpty ? a : b; // intersect with empty = empty (return the empty operand)
  }

  const ga = toBufferGeometry(a);
  const gb = toBufferGeometry(b);
  const brushA = new Brush(ga);
  const brushB = new Brush(gb);
  brushA.updateMatrixWorld();
  brushB.updateMatrixWorld();

  const result = evaluator.evaluate(brushA, brushB, OP[op]);
  const out = fromBufferGeometry(result.geometry);

  ga.dispose();
  gb.dispose();
  result.geometry.dispose();
  return out;
}
