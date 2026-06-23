import type { LiteralValue, SocketType } from '@/graph/types';

/**
 * Render a node's literal input value as a JavaScript expression for generated code.
 * Strings (incl. colors and enum selections) are quoted; numbers/booleans verbatim;
 * vectors become array literals.
 */
export function renderLiteral(value: LiteralValue | undefined, type: SocketType): string {
  if (value === undefined) return defaultForType(type);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.join(', ')}]`;
  return 'undefined';
}

function defaultForType(type: SocketType): string {
  switch (type) {
    case 'number':
      return '0';
    case 'boolean':
      return 'false';
    case 'string':
    case 'color':
      return '""';
    case 'vector3':
      return '[0, 0, 0]';
    default:
      return 'undefined';
  }
}
