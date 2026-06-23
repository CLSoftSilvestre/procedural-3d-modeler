import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerBuiltinNodes } from '@/nodes';
import { App } from '@/app/App';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import '@/app/styles.css';

registerBuiltinNodes();

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
