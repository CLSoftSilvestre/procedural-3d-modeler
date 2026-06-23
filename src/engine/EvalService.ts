import * as Comlink from 'comlink';
import type { Graph } from '@/graph/types';
import type { EvalResult } from './evaluate';
import type { EvalWorkerApi } from './worker/evalWorker';

/**
 * Main-thread front-end to the evaluation worker.
 *
 * Coalesces requests: while an evaluation is in flight, only the most recent graph is
 * kept pending; intermediate ones are dropped. Callers always get the result for the
 * latest graph they submitted. See ARCHITECTURE.md §4.
 */
export class EvalService {
  private worker: Worker;
  private api: Comlink.Remote<EvalWorkerApi>;
  private running = false;
  private pending: { graph: Graph; seed: number } | null = null;

  constructor() {
    this.worker = new Worker(new URL('./worker/evalWorker.ts', import.meta.url), {
      type: 'module',
    });
    this.api = Comlink.wrap<EvalWorkerApi>(this.worker);
  }

  /**
   * Request an evaluation. `onResult` fires once with the result for the latest graph.
   * If a newer request arrives first, older callbacks are superseded (not called).
   */
  request(graph: Graph, seed: number, onResult: (result: EvalResult) => void): void {
    this.pending = { graph, seed };
    if (this.running) return;
    void this.drain(onResult);
  }

  private async drain(onResult: (result: EvalResult) => void): Promise<void> {
    this.running = true;
    try {
      while (this.pending) {
        const { graph, seed } = this.pending;
        this.pending = null;
        const result = await this.api.evaluate(graph, seed);
        // Only deliver if nothing newer is queued.
        if (!this.pending) onResult(result);
      }
    } finally {
      this.running = false;
    }
  }

  dispose(): void {
    this.worker.terminate();
  }
}
