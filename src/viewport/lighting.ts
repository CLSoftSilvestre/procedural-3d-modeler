/** Viewport lighting settings — drives the ambient + key/fill rig and the background. */
export interface Lighting {
  ambient: number;
  key: number;
  background: string;
}

export const DEFAULT_LIGHTING: Lighting = { ambient: 0.6, key: 1.0, background: '#1a1a1f' };

export interface LightingPreset {
  id: string;
  name: string;
  lighting: Lighting;
}

export const LIGHTING_PRESETS: LightingPreset[] = [
  { id: 'studio', name: 'Studio', lighting: { ambient: 0.6, key: 1.0, background: '#1a1a1f' } },
  { id: 'soft', name: 'Soft', lighting: { ambient: 1.0, key: 0.55, background: '#23232b' } },
  { id: 'dramatic', name: 'Dramatic', lighting: { ambient: 0.18, key: 1.7, background: '#0c0c10' } },
  { id: 'bright', name: 'Bright', lighting: { ambient: 1.25, key: 1.2, background: '#2b2d36' } },
  { id: 'white', name: 'White Studio', lighting: { ambient: 0.9, key: 1.1, background: '#e9ebf0' } },
];
