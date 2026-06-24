import { useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useStore } from '@/state/store';
import { useEvaluatedGeometry } from '@/engine/useEvaluatedGeometry';
import { nodeDefsByCategory } from '@/nodes/registry';
import { downloadGraph, deserializeGraph } from '@/graph/serialize';
import { EXAMPLES, getExample } from '@/examples';
import { Viewport } from '@/viewport/Viewport';
import { GraphEditor } from '@/ui/GraphEditor';
import { Inspector } from '@/ui/Inspector';
import { ExportPanel } from '@/ui/ExportPanel';

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
                addNode(def.type, { x: 80 + Math.random() * 120, y: 80 + Math.random() * 120 })
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

function Toolbar({ onExport }: { onExport: () => void }) {
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const graph = useStore((s) => s.graph);
  const loadGraph = useStore((s) => s.loadGraph);
  const setNotice = useStore((s) => s.setNotice);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = deserializeGraph(text);
    if (result.ok) {
      loadGraph(result.graph);
      setNotice(
        result.warnings.length
          ? { kind: 'info', message: result.warnings.join('; ') }
          : { kind: 'info', message: `Loaded ${file.name}` },
      );
    } else {
      setNotice({ kind: 'error', message: result.error });
    }
    e.target.value = '';
  }

  return (
    <div className="toolbar">
      <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)">
        ↶ Undo
      </button>
      <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl/Cmd+Shift+Z)">
        ↷ Redo
      </button>
      <span className="toolbar__sep" />
      <button onClick={() => downloadGraph(graph)}>⭳ Save</button>
      <button onClick={() => fileRef.current?.click()}>⭱ Load</button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={onFile}
      />
      <span className="toolbar__sep" />
      <select
        className="toolbar__examples"
        value=""
        onChange={(e) => {
          const ex = getExample(e.target.value);
          if (ex) {
            loadGraph(ex.graph);
            setNotice({ kind: 'info', message: `Loaded example: ${ex.name}` });
          }
          e.target.value = '';
        }}
      >
        <option value="" disabled>
          Examples…
        </option>
        {EXAMPLES.map((ex) => (
          <option key={ex.id} value={ex.id}>
            {ex.name}
          </option>
        ))}
      </select>
      <span className="toolbar__sep" />
      <button className="toolbar__primary" onClick={onExport}>
        ⤓ Export Code
      </button>
    </div>
  );
}

export function App() {
  const graph = useStore((s) => s.graph);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const notice = useStore((s) => s.notice);
  const [showExport, setShowExport] = useState(false);

  const { geometry, material, errors, evaluating } = useEvaluatedGeometry(graph);

  // Keyboard shortcuts for undo/redo.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return (
    <div className="app">
      <header className="app__header">
        <span className="app__brand">Procedural 3D Modeler</span>
        <span className="app__sub">three.js generator</span>
        <Toolbar onExport={() => setShowExport(true)} />
        <span className="app__stats">
          {evaluating && <span className="app__busy">evaluating…</span>}
          {geometry ? `${geometry.metadata.triCount.toLocaleString()} tris` : 'no output'}
        </span>
      </header>

      {notice && <div className={`app__notice app__notice--${notice.kind}`}>{notice.message}</div>}

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
            <Viewport geometry={geometry} material={material} />
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

      {showExport && <ExportPanel onClose={() => setShowExport(false)} />}
    </div>
  );
}
