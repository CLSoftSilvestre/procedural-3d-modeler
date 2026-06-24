/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';

// GitHub Pages serves a project site under /<repo>/. The deploy workflow sets DEPLOY_BASE
// to that subpath; local dev/build default to '/'.
const base = process.env.DEPLOY_BASE || '/';

// Expose the package version to the app (shown in the About modal).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      // App prompts the user to reload when a new version is available (see src/pwa.ts).
      registerType: 'prompt',
      // Don't run the PWA plugin during unit tests.
      disable: !!process.env.VITEST,
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The main bundle + eval worker are large; precache them for full offline use.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Procedural 3D Modeler',
        short_name: '3D Modeler',
        description: 'Node-based procedural geometry that exports production-ready three.js code.',
        id: base,
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#11141b',
        theme_color: '#11141b',
        categories: ['graphics', 'productivity', 'developer'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split big, rarely-changing vendors into their own chunks so the browser caches
        // them across app deploys (and downloads them in parallel on first load).
        manualChunks: {
          three: ['three'],
          reactflow: ['@xyflow/react'],
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
});
