import { describe, expect, it } from 'vitest';
import { registerBuiltinNodes } from '@/nodes';
import { evaluateGraph } from '@/engine/evaluate';
import { generateModule } from '@/codegen/generate';
import { runGenerated } from '@/codegen/runGenerated';
import { EXAMPLES } from '@/examples';

registerBuiltinNodes();

describe('example library', () => {
  for (const ex of EXAMPLES) {
    describe(ex.name, () => {
      it('evaluates to non-trivial geometry', () => {
        const { geometry, errors } = evaluateGraph(ex.graph);
        expect(errors).toHaveLength(0);
        expect(geometry).not.toBeNull();
        expect(geometry!.metadata.triCount).toBeGreaterThan(50);
      });

      it('exports code that runs and matches the evaluation', () => {
        const evaluated = evaluateGraph(ex.graph).geometry!;
        const result = generateModule(ex.graph, { functionName: 'createModel' });
        expect(result.code).toContain('export function createModel(');

        const mesh = runGenerated(result);
        const genPos = mesh.geometry.getAttribute('position').array as Float32Array;
        expect(genPos.length).toBe(evaluated.positions.length);
        let maxDiff = 0;
        for (let i = 0; i < genPos.length; i++) {
          maxDiff = Math.max(maxDiff, Math.abs(genPos[i]! - evaluated.positions[i]!));
        }
        expect(maxDiff).toBeLessThan(1e-3);
      });
    });
  }
});
