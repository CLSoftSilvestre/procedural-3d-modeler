import type { LiteralValue } from '@/graph/types';

/**
 * Ready-made PBR material presets — approximate real-world surfaces. Each maps directly
 * to the Material node's input values, so applying one just fills those fields (the user
 * can then tweak). Roughness/metalness chosen to read convincingly under the default
 * three-point lighting.
 */
export interface MaterialPreset {
  id: string;
  name: string;
  group: 'Metal' | 'Plastic' | 'Wood' | 'Mineral' | 'Other';
  values: Record<string, LiteralValue>;
}

const m = (
  id: string,
  name: string,
  group: MaterialPreset['group'],
  type: 'standard' | 'physical',
  color: string,
  roughness: number,
  metalness: number,
  extra: Partial<Record<string, LiteralValue>> = {},
): MaterialPreset => ({
  id,
  name,
  group,
  values: { type, color, roughness, metalness, opacity: 1, flatShading: false, wireframe: false, ...extra },
});

export const MATERIAL_PRESETS: MaterialPreset[] = [
  m('stainless-steel', 'Stainless Steel', 'Metal', 'physical', '#b8bcc0', 0.3, 1),
  m('brushed-aluminum', 'Brushed Aluminum', 'Metal', 'physical', '#c8ccce', 0.45, 1),
  m('chrome', 'Chrome', 'Metal', 'physical', '#e8eaec', 0.05, 1),
  m('gold', 'Gold', 'Metal', 'physical', '#d4af37', 0.25, 1),
  m('copper', 'Copper', 'Metal', 'physical', '#b87333', 0.3, 1),
  m('cast-iron', 'Cast Iron', 'Metal', 'standard', '#3a3b3d', 0.6, 0.9),
  m('painted-gloss', 'Painted (Gloss)', 'Plastic', 'standard', '#c0392b', 0.2, 0),
  m('plastic-matte', 'Plastic (Matte)', 'Plastic', 'standard', '#2e86de', 0.7, 0),
  m('rubber', 'Rubber', 'Plastic', 'standard', '#1c1c1e', 0.95, 0),
  m('oak', 'Oak Wood', 'Wood', 'standard', '#b5853f', 0.7, 0),
  m('walnut', 'Walnut Wood', 'Wood', 'standard', '#5c4326', 0.65, 0),
  m('concrete', 'Concrete', 'Mineral', 'standard', '#9b9a96', 0.9, 0),
  m('ceramic', 'Ceramic', 'Mineral', 'physical', '#f2f0eb', 0.35, 0),
  m('terracotta', 'Terracotta', 'Mineral', 'standard', '#c66b3d', 0.85, 0),
  m('glass', 'Glass', 'Other', 'physical', '#aee3ff', 0.05, 0, { opacity: 0.3 }),
];

export function getMaterialPreset(id: string): MaterialPreset | undefined {
  return MATERIAL_PRESETS.find((p) => p.id === id);
}
