import * as Comlink from 'comlink';
import { registerBuiltinNodes } from '@/nodes';
import { evaluateGraph, EvalCache, type EvalResult } from '@/engine/evaluate';
import type { Graph } from '@/graph/types';
import type { EvalQuality } from '@/nodes/NodeDef';

registerBuiltinNodes();

// Persistent cache lives in the worker so subgraph results survive across evaluations.
const cache = new EvalCache();

const api = {
  evaluate(graph: Graph, seed = 1, quality: EvalQuality = 'full', time = 0): EvalResult {
    return evaluateGraph(graph, seed, cache, quality, time);
  },
  clearCache(): void {
    cache.clear();
  },
  cacheSize(): number {
    return cache.size;
  },
};

export type EvalWorkerApi = typeof api;

Comlink.expose(api);
