import { useEffect, useState } from 'react';
import type { Graph } from '@/graph/types';
import type { GeometryData } from '@/geometry/GeometryData';
import { EvalService } from './EvalService';
import type { EvalError } from './evaluate';

interface EvalState {
  geometry: GeometryData | null;
  errors: EvalError[];
  evaluating: boolean;
}

/**
 * Evaluate `graph` off the main thread, returning the latest geometry/errors.
 *
 * The EvalService (and its worker) is created in an effect and torn down on unmount,
 * so it survives React StrictMode's mount→unmount→remount cycle correctly: the worker
 * is recreated on remount rather than being left terminated.
 */
export function useEvaluatedGeometry(graph: Graph, seed = 1): EvalState {
  const [service, setService] = useState<EvalService | null>(null);
  const [state, setState] = useState<EvalState>({
    geometry: null,
    errors: [],
    evaluating: false,
  });

  useEffect(() => {
    let svc: EvalService | null = null;
    try {
      svc = new EvalService();
      setService(svc);
    } catch (err) {
      setState((s) => ({
        ...s,
        errors: [{ nodeId: '', message: `Failed to start evaluation worker: ${String(err)}` }],
      }));
    }
    return () => {
      svc?.dispose();
      setService(null);
    };
  }, []);

  useEffect(() => {
    if (!service) return;
    setState((s) => ({ ...s, evaluating: true }));
    service.request(graph, seed, (result) => {
      setState({ geometry: result.geometry, errors: result.errors, evaluating: false });
    });
  }, [service, graph, seed]);

  return state;
}
