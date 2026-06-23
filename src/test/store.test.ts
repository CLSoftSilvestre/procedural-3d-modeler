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
    past: [],
    future: [],
    lastEditKey: null,
  });
}

describe('store mutations (history snapshots)', () => {
  beforeEach(reset);

  it('adds a node without throwing (regression: structuredClone of Immer draft)', () => {
    const { addNode } = useStore.getState();
    expect(() => addNode('primitive.box', { x: 0, y: 0 })).not.toThrow();
    expect(useStore.getState().graph.nodes).toHaveLength(1);
    expect(useStore.getState().past).toHaveLength(1); // empty graph snapshotted
  });

  it('sets an output node when an output is added', () => {
    useStore.getState().addNode('output.mesh', { x: 0, y: 0 });
    const id = useStore.getState().graph.nodes[0]!.id;
    expect(useStore.getState().graph.outputNodeId).toBe(id);
  });

  it('undo/redo restore graph state', () => {
    const { addNode } = useStore.getState();
    addNode('primitive.box', { x: 0, y: 0 });
    addNode('output.mesh', { x: 300, y: 0 });
    expect(useStore.getState().graph.nodes).toHaveLength(2);

    useStore.getState().undo();
    expect(useStore.getState().graph.nodes).toHaveLength(1);

    useStore.getState().redo();
    expect(useStore.getState().graph.nodes).toHaveLength(2);
  });

  it('history snapshots are detached plain objects (mutating later does not corrupt past)', () => {
    const { addNode, setNodeValue } = useStore.getState();
    const boxId = addNode('primitive.box', { x: 0, y: 0 });
    setNodeValue(boxId, 'width', 5);
    useStore.getState().undo();
    // After undo, width returns to its default (snapshot was independent).
    const node = useStore.getState().graph.nodes.find((n) => n.id === boxId);
    expect(node?.values.width).toBe(1);
  });
});
