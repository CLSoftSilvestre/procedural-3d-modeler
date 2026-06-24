import { GRAPH_VERSION } from './types';

/**
 * Versioned-graph migration. Saved/autosaved `.graph.json` files carry a `version`. As the
 * schema evolves we add a migration here that upgrades the previous format to the next, so
 * old files keep loading. Migrations run as an ordered chain from the file's version up to
 * the current {@link GRAPH_VERSION}. See ARCHITECTURE.md §3.
 */

/** A loosely-typed graph document as read from disk (pre-validation). */
export type RawGraph = Record<string, unknown> & { version?: unknown };

export interface Migration {
  /** The schema version this migration produces. */
  to: string;
  /** Human-readable summary of what changed (surfaced as a load warning). */
  note: string;
  /** Transform a document at the previous version into the `to` version. Must be pure. */
  migrate: (g: RawGraph) => RawGraph;
}

/** The earliest schema version we recognize (the format before the first migration). */
export const BASE_VERSION = '0.1.0';

/**
 * Ordered oldest → newest. The first migration upgrades a {@link BASE_VERSION} (or
 * versionless / unrecognized-older) document; each subsequent one upgrades its predecessor.
 */
export const MIGRATIONS: Migration[] = [
  {
    to: '0.2.0',
    note: 'Primitives gained a built-in transform; normalized node value bags and graph fields.',
    migrate: (g) => ({
      ...g,
      params: Array.isArray(g.params) ? g.params : [],
      outputNodeId: g.outputNodeId ?? null,
      nodes: (Array.isArray(g.nodes) ? g.nodes : []).map((n) => {
        const node = (n ?? {}) as Record<string, unknown>;
        return {
          ...node,
          values: node.values && typeof node.values === 'object' ? node.values : {},
          position: node.position ?? { x: 0, y: 0 },
        };
      }),
    }),
  },
];

export interface MigrationResult {
  graph: RawGraph;
  /** The version detected on the input document. */
  fromVersion: string;
  /** `note`s of the migrations that ran, in order. Empty if already current. */
  applied: string[];
  warnings: string[];
}

/** Compare dotted numeric versions; returns true if `a` is strictly greater than `b`. */
function isNewer(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => parseInt(n, 10));
  const pb = b.split('.').map((n) => parseInt(n, 10));
  if (pa.some(Number.isNaN)) return false; // non-numeric → not "newer"
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/**
 * Upgrade a raw graph document to the latest schema. Pure; the migration list and target
 * version are injectable for testing. Files newer than `latest` are returned untouched with
 * a warning (best-effort forward compatibility).
 */
export function migrateGraph(
  raw: RawGraph,
  migrations: Migration[] = MIGRATIONS,
  latest: string = GRAPH_VERSION,
): MigrationResult {
  const fromVersion = typeof raw.version === 'string' ? raw.version : '(none)';
  const warnings: string[] = [];

  if (fromVersion === latest) {
    return { graph: raw, fromVersion, applied: [], warnings };
  }

  // [base, ...each migration's resulting version] — the recognized version timeline.
  const timeline = [BASE_VERSION, ...migrations.map((m) => m.to)];
  let start = timeline.indexOf(fromVersion);

  if (start === -1) {
    if (isNewer(fromVersion, latest)) {
      warnings.push(
        `This file was created by a newer version (${fromVersion}); loading as-is — some features may not apply.`,
      );
      return { graph: raw, fromVersion, applied: [], warnings };
    }
    warnings.push(`Unrecognized graph version "${fromVersion}"; upgrading from the base format.`);
    start = 0;
  }

  let graph = raw;
  const applied: string[] = [];
  for (let i = start; i < migrations.length; i++) {
    const m = migrations[i]!;
    graph = { ...m.migrate(graph), version: m.to };
    applied.push(m.note);
  }

  // Stamp the latest version even if no migration covered the final hop.
  graph = { ...graph, version: latest };
  if (applied.length) {
    warnings.push(`Upgraded graph from ${fromVersion} to ${latest}.`);
  }
  return { graph, fromVersion, applied, warnings };
}
