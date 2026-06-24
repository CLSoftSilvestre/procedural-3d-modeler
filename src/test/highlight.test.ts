import { describe, expect, it } from 'vitest';
import { highlightCode } from '@/codegen/highlight';

describe('highlightCode', () => {
  it('wraps keywords, strings, numbers and types in spans', () => {
    const html = highlightCode('const x = new THREE.Vector3(1, "a");');
    expect(html).toContain('<span class="hl-keyword">const</span>');
    expect(html).toContain('<span class="hl-keyword">new</span>');
    expect(html).toContain('<span class="hl-type">THREE</span>');
    expect(html).toContain('<span class="hl-number">1</span>');
    expect(html).toContain('<span class="hl-string">"a"</span>');
  });

  it('escapes HTML so injected code is safe', () => {
    const html = highlightCode('return a < b && c > d;');
    expect(html).toContain('&lt;');
    expect(html).toContain('&gt;');
    expect(html).not.toContain('< b'); // raw angle brackets escaped
  });

  it('treats comments as a single token (no inner highlighting)', () => {
    const html = highlightCode('// const here\nx');
    expect(html).toContain('<span class="hl-comment">// const here</span>');
  });
});
