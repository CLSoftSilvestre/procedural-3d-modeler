import { describe, expect, it } from 'vitest';
import { formatCode } from '@/codegen/format';

describe('formatCode (Prettier)', () => {
  it('pretty-prints messy JS', async () => {
    const out = await formatCode('export function f(){const x=1;return x}');
    expect(out).toContain('const x = 1;');
    expect(out.trim().split('\n').length).toBeGreaterThan(1);
  });

  it('handles the R3F JSX output', async () => {
    const out = await formatCode('export function M(){return <mesh geometry={g} material={m}/>}');
    expect(out).toContain('<mesh');
  });

  it('is idempotent', async () => {
    const once = await formatCode('const a=[1,2,3]');
    const twice = await formatCode(once);
    expect(twice).toBe(once);
  });
});
