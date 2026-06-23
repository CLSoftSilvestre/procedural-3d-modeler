import { useEffect, useRef, useState } from 'react';
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
 * Owns a single EvalService for the component's lifetime.
 */
export function useEvaluatedGeometry(graph: Graph, seed = 1): EvalState {
  const serviceRef = useRef<EvalService | null>(null);
  const [state, setState] = useState<EvalState>({
    geometry: null,
    errors: [],
    evaluating: false,
  });

  if (!serviceRef.current) serviceRef.current = new EvalService();

  useEffect(() => {
    return () => {
      serviceRef.current?.dispose();
      serviceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const service = serviceRef.current;
    if (!service) return;
    setState((s) => ({ ...s, evaluating: true }));
    service.request(graph, seed, (result) => {
      setState({ geometry: result.geometry, errors: result.errors, evaluating: false });
    });
  }, [graph, seed]);

  return state;
}
