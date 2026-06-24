import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyGraph } from '@/graph/types';
import { getProjects, saveProject, deleteProject, renameProject, newProjectId, type Project } from '@/state/projects';

function installLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
}

function make(name: string, updatedAt: number): Project {
  return { id: newProjectId(), name, graph: createEmptyGraph(), thumbnail: null, updatedAt };
}

describe('projects store', () => {
  beforeEach(() => installLocalStorage());
  afterEach(() => vi.unstubAllGlobals());

  it('starts empty', () => {
    expect(getProjects()).toEqual([]);
  });

  it('saves, lists newest-first, updates, renames and deletes', () => {
    const a = make('Alpha', 1000);
    const b = make('Beta', 2000);
    saveProject(a);
    saveProject(b);

    let list = getProjects();
    expect(list.map((p) => p.name)).toEqual(['Beta', 'Alpha']); // newest first

    // Upsert by id (not a duplicate).
    saveProject({ ...a, name: 'Alpha2', updatedAt: 3000 });
    list = getProjects();
    expect(list).toHaveLength(2);
    expect(list[0]!.name).toBe('Alpha2');

    renameProject(b.id, 'Beta2');
    expect(getProjects().find((p) => p.id === b.id)!.name).toBe('Beta2');

    deleteProject(a.id);
    expect(getProjects().map((p) => p.id)).toEqual([b.id]);
  });
});
