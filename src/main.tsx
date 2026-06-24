import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerBuiltinNodes } from '@/nodes';
import { App } from '@/app/App';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { useStore } from '@/state/store';
import { loadPersistedGraph, setupAutosave } from '@/state/persistence';
import { registerPWA } from '@/pwa';
import '@/app/styles.css';

registerBuiltinNodes();
registerPWA();

// Restore the last autosaved graph (if any), then keep persisting on change.
const persisted = loadPersistedGraph();
if (persisted) useStore.getState().loadGraph(persisted);
setupAutosave();

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
