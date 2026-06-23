import { useMemo } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useStore } from '@/state/store';
import { evaluateGraph } from '@/engine/evaluate';
import { nodeDefsByCategory } from '@/nodes/registry';
import { Viewport } from '@/viewport/Viewport';
import { GraphEditor } from '@/ui/GraphEditor';
import { Inspector } from '@/ui/Inspector';

function NodePalette() {
  const addNode = useStore((s) => s.addNode);
  const byCategory = useMemo(() => nodeDefsByCategory(), []);

  return (
    <div className="palette">
      {[...byCategory.entries()].map(([category, defs]) => (
        <div className="palette__group" key={category}>
          <span className="palette__category">{category}</span>
          {defs.map((def) => (
            <button
              key={def.type}
              className="palette__btn"
              onClick={() =>
                addNode(def.type, {
                  x: 80 + Math.random() * 120,
                  y: 80 + Math.random() * 120,
                })
              }
            >
              + {def.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export function App() {
  const graph = useStore((s) => s.graph);

  // Phase 1: synchronous main-thread evaluation on every graph change.
  const { geometry, errors } = useMemo(() => evaluateGraph(graph), [graph]);

  return (
    <div className="app">
      <header className="app__header">
        <span className="app__brand">Procedural 3D Modeler</span>
        <span className="app__sub">three.js generator · M0</span>
        <span className="app__stats">
          {geometry ? `${geometry.metadata.triCount.toLocaleString()} tris` : 'no output'}
        </span>
      </header>

      <div className="app__body">
        <aside className="app__palette">
          <NodePalette />
        </aside>

        <main className="app__center">
          <section className="app__graph">
            <ReactFlowProvider>
              <GraphEditor />
            </ReactFlowProvider>
          </section>
          <section className="app__viewport">
            <Viewport geometry={geometry} />
            {errors.length > 0 && (
              <div className="viewport__errors">
                {errors.map((e, i) => (
                  <div key={i}>⚠ {e.message}</div>
                ))}
              </div>
            )}
          </section>
        </main>

        <aside className="app__inspector">
          <Inspector />
        </aside>
      </div>
    </div>
  );
}
