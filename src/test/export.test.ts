import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { fromBufferGeometry } from '@/geometry/GeometryData';
import { exportSTL, exportOBJ } from '@/export/mesh';

const box = fromBufferGeometry(new THREE.BoxGeometry(1, 1, 1));

describe('mesh export (STL / OBJ)', () => {
  it('exports a non-trivial binary STL', () => {
    const blob = exportSTL(box, true);
    // 80-byte header + 4-byte count + 50 bytes/triangle (12 tris for a box).
    expect(blob.size).toBe(84 + 12 * 50);
  });

  it('exports ASCII STL with facets', async () => {
    const text = await exportSTL(box, false).text();
    expect(text).toContain('solid');
    expect(text).toContain('facet normal');
    expect(text.trim().endsWith('endsolid exported')).toBe(true);
  });

  it('exports an OBJ with vertices and faces', async () => {
    const text = await exportOBJ(box).text();
    expect(text).toContain('v ');
    expect(text).toContain('f ');
  });
});
