import { registerSW } from 'virtual:pwa-register';
import { useStore } from '@/state/store';

/**
 * Register the service worker for offline use. On a new deployment we show a small,
 * dismissible "Reload" banner (rather than silently reloading and losing unsaved work);
 * the graph autosaves regardless. Shows a transient "offline ready" notice on first cache.
 */
export function registerPWA(): void {
  const updateSW = registerSW({
    onNeedRefresh() {
      showUpdateBanner(() => updateSW(true));
    },
    onOfflineReady() {
      const { setNotice } = useStore.getState();
      setNotice({ kind: 'info', message: '✓ Ready to work offline' });
      setTimeout(() => {
        if (useStore.getState().notice?.message === '✓ Ready to work offline') setNotice(null);
      }, 4000);
    },
  });
}

function showUpdateBanner(onReload: () => void): void {
  if (document.querySelector('.pwa-toast')) return;
  const el = document.createElement('div');
  el.className = 'pwa-toast';
  el.innerHTML = `
    <span class="pwa-toast__msg">A new version is available.</span>
    <button class="pwa-toast__reload" type="button">Reload</button>
    <button class="pwa-toast__dismiss" type="button" aria-label="Dismiss">✕</button>
  `;
  el.querySelector('.pwa-toast__reload')?.addEventListener('click', onReload);
  el.querySelector('.pwa-toast__dismiss')?.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
}
