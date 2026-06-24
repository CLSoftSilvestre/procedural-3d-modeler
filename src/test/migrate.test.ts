import { describe, expect, it } from 'vitest';
import { registerBuiltinNodes } from '@/nodes';
import { migrateGraph, type Migration, type RawGraph } from '@/graph/migrate';
import { deserializeGraph } from '@/graph/serialize';
import { GRAPH_VERSION } from '@/graph/types';

registerBuiltinNodes();

describe('migrateGraph', () => {
  it('returns the document untouched when already current', () => {
    const raw: RawGraph = { version: GRAPH_VERSION, nodes: [], edges: [] };
    const r = migrateGraph(raw);
    expect(r.applied).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.graph).toBe(raw);
  });

  it('upgrades a 0.1.0 document to the current schema and normalizes nodes', () => {
    const raw: RawGraph = {
      version: '0.1.0',
      nodes: [{ id: 'a', type: 'primitive.box' }], // no values / position
      edges: [],
    };
    const r = migrateGraph(raw);
    expect(r.fromVersion).toBe('0.1.0');
    expect(r.applied.length).toBeGreaterThan(0);
    expect((r.graph as { version: string }).version).toBe(GRAPH_VERSION);
    const node = (r.graph.nodes as Record<string, unknown>[])[0]!;
    expect(node.values).toEqual({});
    expect(node.position).toEqual({ x: 0, y: 0 });
    expect(r.warnings.join(' ')).toContain('Upgraded');
  });

  it('does not mutate the input document', () => {
    const raw: RawGraph = { version: '0.1.0', nodes: [{ id: 'a', type: 'primitive.box' }], edges: [] };
    const before = JSON.stringify(raw);
    migrateGraph(raw);
    expect(JSON.stringify(raw)).toBe(before);
  });

  it('leaves a newer-than-current file as-is with a warning', () => {
    const raw: RawGraph = { version: '99.0.0', nodes: [], edges: [] };
    const r = migrateGraph(raw);
    expect(r.applied).toEqual([]);
    expect(r.graph).toBe(raw);
    expect(r.warnings.join(' ')).toContain('newer version');
  });

  it('treats a versionless document as base and warns', () => {
    const raw: RawGraph = { nodes: [{ id: 'a', type: 'primitive.box' }], edges: [] };
    const r = migrateGraph(raw);
    expect(r.fromVersion).toBe('(none)');
    expect(r.applied.length).toBeGreaterThan(0);
    expect(r.warnings.join(' ')).toContain('Unrecognized');
  });

  it('chains migrations and starts from the file’s version (injected chain)', () => {
    const chain: Migration[] = [
      { to: 'a', note: 'A', migrate: (g) => ({ ...g, steps: [...((g.steps as string[]) ?? []), 'a'] }) },
      { to: 'b', note: 'B', migrate: (g) => ({ ...g, steps: [...((g.steps as string[]) ?? []), 'b'] }) },
    ];
    // From base: both run.
    const full = migrateGraph({ version: '0.1.0' }, chain, 'b');
    expect(full.applied).toEqual(['A', 'B']);
    expect(full.graph.steps).toEqual(['a', 'b']);
    // From the intermediate version: only the later migration runs.
    const partial = migrateGraph({ version: 'a' }, chain, 'b');
    expect(partial.applied).toEqual(['B']);
    expect(partial.graph.steps).toEqual(['b']);
  });
});

describe('deserializeGraph (with migration)', () => {
  it('loads a legacy 0.1.0 graph, upgrading it on the way in', () => {
    const legacy = JSON.stringify({
      version: '0.1.0',
      nodes: [
        { id: 'a', type: 'primitive.box', position: { x: 0, y: 0 } },
        { id: 'out', type: 'output.mesh', position: { x: 200, y: 0 } },
      ],
      edges: [{ id: 'e', source: 'a', sourceSocket: 'geometry', target: 'out', targetSocket: 'geometry' }],
      outputNodeId: 'out',
    });
    const result = deserializeGraph(legacy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.version).toBe(GRAPH_VERSION);
    expect(result.graph.params).toEqual([]);
    expect(result.warnings.join(' ')).toContain('Upgraded');
  });

  it('still rejects unknown node types after migration', () => {
    const bad = JSON.stringify({ version: '0.1.0', nodes: [{ type: 'nope.nope' }], edges: [] });
    const result = deserializeGraph(bad);
    expect(result.ok).toBe(false);
  });
});
