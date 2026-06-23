import { useMemo, useState } from 'react';
import { useStore } from '@/state/store';
import { generateModule } from '@/codegen/generate';

interface ExportPanelProps {
  onClose: () => void;
}

/** Modal showing the generated three.js module for the current graph. */
export function ExportPanel({ onClose }: ExportPanelProps) {
  const graph = useStore((s) => s.graph);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => {
    try {
      return { code: generateModule(graph).code, error: null as string | null };
    } catch (err) {
      return { code: '', error: err instanceof Error ? err.message : String(err) };
    }
  }, [graph]);

  function copy() {
    void navigator.clipboard.writeText(result.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function download() {
    const blob = new Blob([result.code], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'model.ts';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <span>Export — vanilla three.js module</span>
          <div className="modal__actions">
            <button onClick={copy} disabled={!!result.error}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button onClick={download} disabled={!!result.error}>
              Download .ts
            </button>
            <button onClick={onClose}>Close</button>
          </div>
        </div>
        {result.error ? (
          <div className="modal__error">⚠ {result.error}</div>
        ) : (
          <pre className="modal__code">{result.code}</pre>
        )}
      </div>
    </div>
  );
}
