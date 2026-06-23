import { describe, expect, it } from 'vitest';
import { makeNoise3 } from '@/geometry/noise';
import { helperSourceFor } from '@/codegen/helpers';

describe('codegen noise helper parity', () => {
  it('emitted makeNoise3 matches the runtime makeNoise3 (drift guard)', () => {
    const src = helperSourceFor(['noise']);
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const emitted = new Function(`${src}\nreturn makeNoise3;`)() as typeof makeNoise3;

    const runtime = makeNoise3(123);
    const generated = emitted(123);
    const samples: [number, number, number][] = [
      [0, 0, 0],
      [1.3, -2.7, 0.4],
      [5.5, 5.5, 5.5],
      [-3.2, 1.1, 9.9],
    ];
    for (const [x, y, z] of samples) {
      expect(generated(x, y, z)).toBeCloseTo(runtime(x, y, z), 10);
    }
  });
});
