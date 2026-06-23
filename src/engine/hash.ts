/**
 * Small, fast, stable string hash (FNV-1a, 32-bit) rendered as hex.
 * Used to key the evaluation cache by node content + upstream content. Not cryptographic.
 */
export function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
