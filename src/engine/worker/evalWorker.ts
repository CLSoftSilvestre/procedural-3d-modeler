import * as Comlink from 'comlink';
import { registerBuiltinNodes } from '@/nodes';
import { evaluateGraph, EvalCache, type EvalResult } from '@/engine/evaluate';
import type { Graph } from '@/graph/types';

registerBuiltinNodes();

// Persistent cache lives in the worker so subgraph results survive across evaluations.
const cache = new EvalCache();

const api = {
  evaluate(graph: Graph, seed = 1): EvalResult {
    return evaluateGraph(graph, seed, cache);
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
