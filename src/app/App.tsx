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
import { ParamsPanel } from '@/ui/ParamsPanel';
import { ExportPanel } from '@/ui/ExportPanel';
import { Icon } from '@/ui/Icon';
import { categoryColor } from '@/ui/categoryColors';

function NodePalette() {
  const addNode = useStore((s) => s.addNode);
  const byCategory = useMemo(() => nodeDefsByCategory(), []);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      [...byCategory.entries()]
        .map(([category, defs]) => {
          const matches = defs.filter(
            (d) => !q || d.label.toLowerCase().includes(q) || category.toLowerCase().includes(q),
          );
          return [category, matches] as const;
        })
        .filter(([, defs]) => defs.length > 0),
    [byCategory, q],
  );

  return (
    <div className="palette">
      <input
        className="palette__search"
        type="search"
        placeholder="Search nodes…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {filtered.map(([category, defs]) => (
        <div className="palette__group" key={category}>
          <span className="palette__category">
            <span className="palette__cat-dot" style={{ background: categoryColor(category) }} />
            {category}
          </span>
          {defs.map((def) => (
            <button
              key={def.type}
              className="palette__btn"
              title={def.description ?? def.label}
              onClick={() =>
                addNode(def.type, { x: 80 + Math.random() * 120, y: 80 + Math.random() * 120 })
              }
            >
              + {def.label}
            </button>
          ))}
        </div>
      ))}
      {filtered.length === 0 && <div className="panel__empty">No nodes match.</div>}
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
  const newGraph = useStore((s) => s.newGraph);
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
      <button
        onClick={() => {
          if (graph.nodes.length === 0 || confirm('Start a new empty graph? (Undo restores it.)')) {
            newGraph();
          }
        }}
        title="New empty graph"
      >
        <Icon name="new" /> New
      </button>
      <span className="toolbar__sep" />
      <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)">
        <Icon name="undo" /> Undo
      </button>
      <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl/Cmd+Shift+Z)">
        <Icon name="redo" /> Redo
      </button>
      <span className="toolbar__sep" />
      <button onClick={() => downloadGraph(graph)} title="Save graph as JSON">
        <Icon name="save" /> Save
      </button>
      <button onClick={() => fileRef.current?.click()} title="Load graph JSON">
        <Icon name="load" /> Load
      </button>
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
        <Icon name="export" /> Export
      </button>
    </div>
  );
}

export function App() {
  const graph = useStore((s) => s.graph);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const notice = useStore((s) => s.notice);
  const loadGraph = useStore((s) => s.loadGraph);
  const [showExport, setShowExport] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [showGrid, setShowGrid] = useState(true);

  const { geometry, material, errors, evaluating } = useEvaluatedGeometry(graph);
  const errorNodeIds = useMemo(
    () => new Set(errors.map((e) => e.nodeId).filter(Boolean)),
    [errors],
  );

  function quickStartBox() {
    const s = useStore.getState();
    const boxId = s.addNode('primitive.box', { x: 120, y: 90 });
    const outId = s.addNode('output.mesh', { x: 440, y: 90 });
    s.addEdge({ source: boxId, sourceSocket: 'geometry', target: outId, targetSocket: 'geometry' });
  }

  // Keyboard shortcuts: undo/redo + duplicate/copy/paste.
  useEffect(() => {
    function isTyping(): boolean {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable;
    }
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      const s = useStore.getState();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (key === 'd' && s.selectedNodeId) {
        e.preventDefault();
        s.duplicateNode(s.selectedNodeId);
      } else if (key === 'c' && s.selectedNodeId && !isTyping()) {
        s.copyNode(s.selectedNodeId);
      } else if (key === 'v' && s.clipboard && !isTyping()) {
        s.pasteNode();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path
              d="M12 2 21 7v10l-9 5-9-5V7z"
              fill="none"
              stroke="#6ea8fe"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M12 2v20M3 7l9 5 9-5" fill="none" stroke="#6ea8fe" strokeWidth="1.3" opacity="0.6" />
          </svg>
        </div>
        <div className="app__title">
          <span className="app__brand">Procedural 3D Modeler</span>
          <span className="app__sub">three.js generator</span>
        </div>
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
              <GraphEditor errorNodeIds={errorNodeIds} />
            </ReactFlowProvider>
            {graph.nodes.length === 0 && (
              <div className="emptystate">
                <div className="emptystate__card">
                  <h2>Start modeling</h2>
                  <p>
                    Add nodes from the palette on the left, or jump in with a starter graph.
                  </p>
                  <div className="emptystate__actions">
                    <button className="emptystate__primary" onClick={quickStartBox}>
                      <Icon name="new" /> Box → Output
                    </button>
                    <button onClick={() => loadGraph(EXAMPLES[0]!.graph)}>
                      Load “{EXAMPLES[0]!.name}” example
                    </button>
                  </div>
                  <p className="emptystate__hint">
                    Tip: connect a node’s output handle to the Output node to see it render.
                  </p>
                </div>
              </div>
            )}
          </section>
          <section className="app__viewport">
            <div className="viewport__toolbar">
              <button
                className={wireframe ? 'is-active' : ''}
                onClick={() => setWireframe((v) => !v)}
                title="Toggle wireframe"
              >
                Wireframe
              </button>
              <button
                className={showGrid ? 'is-active' : ''}
                onClick={() => setShowGrid((v) => !v)}
                title="Toggle grid"
              >
                Grid
              </button>
              {geometry && (
                <span className="viewport__stats">
                  {geometry.metadata.triCount.toLocaleString()} tris ·{' '}
                  {(geometry.positions.length / 3).toLocaleString()} verts
                </span>
              )}
            </div>
            <Viewport
              geometry={geometry}
              material={material}
              wireframe={wireframe}
              showGrid={showGrid}
            />
            {!geometry && graph.nodes.length > 0 && errors.length === 0 && (
              <div className="viewport__hint">Connect geometry into an Output node to see it here.</div>
            )}
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
          <div className="app__inspector-top">
            <Inspector />
          </div>
          <div className="app__params">
            <ParamsPanel />
          </div>
        </aside>
      </div>

      {showExport && (
        <ExportPanel geometry={geometry} material={material} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
