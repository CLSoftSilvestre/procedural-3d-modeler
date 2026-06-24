import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerBuiltinNodes } from '@/nodes';
import { serializeGraph } from '@/graph/serialize';
import { GRAPH_VERSION, type Graph } from '@/graph/types';

registerBuiltinNodes();

// Minimal in-memory localStorage mock.
function installLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  return store;
}

function sampleGraph(): Graph {
  return {
    version: GRAPH_VERSION,
    nodes: [
      { id: 'a', type: 'primitive.box', position: { x: 0, y: 0 }, values: { width: 3 } },
      { id: 'out', type: 'output.mesh', position: { x: 200, y: 0 }, values: {} },
    ],
    edges: [{ id: 'e', source: 'a', sourceSocket: 'geometry', target: 'out', targetSocket: 'geometry' }],
    params: [],
    outputNodeId: 'out',
  };
}

describe('persistence', () => {
  beforeEach(() => installLocalStorage());
  afterEach(() => vi.unstubAllGlobals());

  it('returns null when nothing is stored', async () => {
    const { loadPersistedGraph } = await import('@/state/persistence');
    expect(loadPersistedGraph()).toBeNull();
  });

  it('round-trips a saved graph', async () => {
    const { loadPersistedGraph } = await import('@/state/persistence');
    localStorage.setItem('p3m.autosave.v1', serializeGraph(sampleGraph()));
    const loaded = loadPersistedGraph();
    expect(loaded).not.toBeNull();
    expect(loaded!.nodes).toHaveLength(2);
    expect(loaded!.nodes[0]!.values.width).toBe(3);
  });

  it('returns null for corrupt data', async () => {
    const { loadPersistedGraph } = await import('@/state/persistence');
    localStorage.setItem('p3m.autosave.v1', '{ not json');
    expect(loadPersistedGraph()).toBeNull();
  });
});
