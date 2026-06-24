import { beforeEach, describe, expect, it } from 'vitest';
import { registerBuiltinNodes } from '@/nodes';
import { useStore } from '@/state/store';
import { createEmptyGraph } from '@/graph/types';
import { getMaterialPreset, MATERIAL_PRESETS } from '@/material/presets';

registerBuiltinNodes();

function reset() {
  useStore.setState({
    graph: createEmptyGraph(),
    selectedNodeId: null,
    notice: null,
    clipboard: null,
    past: [],
    future: [],
    lastEditKey: null,
  });
}

describe('material presets', () => {
  beforeEach(reset);

  it('every preset has the material fields needed by the node', () => {
    for (const p of MATERIAL_PRESETS) {
      expect(p.values).toMatchObject({
        type: expect.any(String),
        color: expect.any(String),
        roughness: expect.any(Number),
        metalness: expect.any(Number),
      });
    }
  });

  it('applying a preset fills the node values in one undoable step', () => {
    const id = useStore.getState().addNode('material.standard', { x: 0, y: 0 });
    const before = useStore.getState().past.length;
    const steel = getMaterialPreset('stainless-steel')!;
    useStore.getState().setNodeValues(id, steel.values);

    const node = useStore.getState().graph.nodes.find((n) => n.id === id)!;
    expect(node.values.color).toBe(steel.values.color);
    expect(node.values.metalness).toBe(1);
    expect(node.values.type).toBe('physical');
    expect(useStore.getState().past.length).toBe(before + 1); // single history entry

    useStore.getState().undo();
    expect(useStore.getState().graph.nodes.find((n) => n.id === id)!.values.color).not.toBe(
      steel.values.color,
    );
  });
});
