import { beforeEach, describe, expect, it } from 'vitest';
import { registerBuiltinNodes } from '@/nodes';
import { useStore } from '@/state/store';
import { createEmptyGraph } from '@/graph/types';

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

describe('node duplicate / copy / paste', () => {
  beforeEach(reset);

  it('duplicates a node with an offset and independent values', () => {
    const id = useStore.getState().addNode('primitive.box', { x: 10, y: 10 });
    useStore.getState().setNodeValue(id, 'width', 4);
    const dupId = useStore.getState().duplicateNode(id)!;

    const nodes = useStore.getState().graph.nodes;
    expect(nodes).toHaveLength(2);
    const dup = nodes.find((n) => n.id === dupId)!;
    expect(dup.id).not.toBe(id);
    expect(dup.values.width).toBe(4);
    expect(dup.position).not.toEqual(nodes.find((n) => n.id === id)!.position);

    // Editing the duplicate must not affect the original.
    useStore.getState().setNodeValue(dupId, 'width', 9);
    expect(useStore.getState().graph.nodes.find((n) => n.id === id)!.values.width).toBe(4);
  });

  it('copies to clipboard and pastes a new node', () => {
    const id = useStore.getState().addNode('primitive.sphere', { x: 0, y: 0 });
    useStore.getState().setNodeValue(id, 'radius', 2);
    useStore.getState().copyNode(id);
    expect(useStore.getState().clipboard?.values.radius).toBe(2);

    const pastedId = useStore.getState().pasteNode()!;
    const pasted = useStore.getState().graph.nodes.find((n) => n.id === pastedId)!;
    expect(pasted.type).toBe('primitive.sphere');
    expect(pasted.values.radius).toBe(2);
    expect(useStore.getState().graph.nodes).toHaveLength(2);
  });

  it('paste with empty clipboard is a no-op', () => {
    expect(useStore.getState().pasteNode()).toBeNull();
    expect(useStore.getState().graph.nodes).toHaveLength(0);
  });
});
