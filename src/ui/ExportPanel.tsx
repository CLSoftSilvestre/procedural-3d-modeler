import { useMemo, useState } from 'react';
import { useStore } from '@/state/store';
import { generateModule, type CodegenTarget } from '@/codegen/generate';
import { downloadGLTF } from '@/export/gltf';
import type { GeometryData } from '@/geometry/GeometryData';
import type { MaterialSpec } from '@/material/MaterialData';

interface ExportPanelProps {
  geometry: GeometryData | null;
  material: MaterialSpec | null;
  onClose: () => void;
}

type Tab = 'code' | 'gltf';

/** Modal: export the current graph as three.js code or as glTF/GLB. */
export function ExportPanel({ geometry, material, onClose }: ExportPanelProps) {
  const graph = useStore((s) => s.graph);
  const [tab, setTab] = useState<Tab>('code');
  const [target, setTarget] = useState<CodegenTarget>('vanilla');
  const [copied, setCopied] = useState(false);
  const [gltfStatus, setGltfStatus] = useState<string | null>(null);

  const result = useMemo(() => {
    try {
      return { code: generateModule(graph, { target }).code, error: null as string | null };
    } catch (err) {
      return { code: '', error: err instanceof Error ? err.message : String(err) };
    }
  }, [graph, target]);

  const fileExt = target === 'r3f' ? 'tsx' : 'ts';

  function copy() {
    void navigator.clipboard.writeText(result.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function downloadCode() {
    const blob = new Blob([result.code], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `model.${fileExt}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportGltf(binary: boolean) {
    if (!geometry) return;
    setGltfStatus('Exporting…');
    try {
      await downloadGLTF(geometry, material, binary);
      setGltfStatus(`Downloaded ${binary ? 'model.glb' : 'model.gltf'}`);
    } catch (err) {
      setGltfStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div className="modal__tabs">
            <button className={tab === 'code' ? 'is-active' : ''} onClick={() => setTab('code')}>
              three.js code
            </button>
            <button className={tab === 'gltf' ? 'is-active' : ''} onClick={() => setTab('gltf')}>
              glTF / GLB
            </button>
          </div>
          <div className="modal__actions">
            {tab === 'code' && (
              <>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value as CodegenTarget)}
                  title="Export target"
                >
                  <option value="vanilla">vanilla three.js</option>
                  <option value="r3f">React Three Fiber</option>
                </select>
                <button onClick={copy} disabled={!!result.error}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button onClick={downloadCode} disabled={!!result.error}>
                  Download .{fileExt}
                </button>
              </>
            )}
            <button onClick={onClose}>Close</button>
          </div>
        </div>

        {tab === 'code' ? (
          result.error ? (
            <div className="modal__error">⚠ {result.error}</div>
          ) : (
            <pre className="modal__code">{result.code}</pre>
          )
        ) : (
          <div className="modal__gltf">
            <p>Export the current model as a baked glTF asset.</p>
            <div className="modal__actions">
              <button onClick={() => exportGltf(true)} disabled={!geometry}>
                Download .glb (binary)
              </button>
              <button onClick={() => exportGltf(false)} disabled={!geometry}>
                Download .gltf (JSON)
              </button>
            </div>
            {!geometry && <div className="modal__error">No geometry to export — connect an Output.</div>}
            {gltfStatus && <div className="modal__status">{gltfStatus}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
