import { describe, expect, it } from 'vitest';
import { isObjectType, isConnectableType } from '@/graph/types';

describe('socket type predicates', () => {
  it('number is connectable but NOT an object type (so it keeps an inline control)', () => {
    expect(isConnectableType('number')).toBe(true);
    expect(isObjectType('number')).toBe(false);
  });

  it('geometry/material/shape are object types (edge-only, no inline control)', () => {
    for (const t of ['geometry', 'material', 'shape'] as const) {
      expect(isObjectType(t)).toBe(true);
      expect(isConnectableType(t)).toBe(true);
    }
  });

  it('plain scalars are neither object nor connectable (inspector-only)', () => {
    for (const t of ['boolean', 'string', 'color'] as const) {
      expect(isObjectType(t)).toBe(false);
      expect(isConnectableType(t)).toBe(false);
    }
  });
});
