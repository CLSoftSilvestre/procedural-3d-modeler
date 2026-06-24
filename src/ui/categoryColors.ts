/** Accent color per node category — used for node headers and palette section dots. */
export const CATEGORY_COLORS: Record<string, string> = {
  Primitives: '#6ea8fe',
  Curves: '#7ddc8a',
  Generators: '#5ad1c9',
  Modifiers: '#c792ea',
  Deformers: '#f78c6c',
  Booleans: '#ff5370',
  Material: '#f2c14e',
  Value: '#c8b6ff',
  Output: '#9aa0ad',
};

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? '#6ea8fe';
}
