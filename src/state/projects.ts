import type { Graph } from '@/graph/types';

/**
 * Local, backend-free project library. Named graph snapshots (with a small thumbnail) are
 * stored in localStorage so users can keep and switch between multiple models. Distinct from
 * the single rolling autosave and from Save/Load-to-file.
 */
export interface Project {
  id: string;
  name: string;
  graph: Graph;
  /** Small JPEG data URL preview, or null. */
  thumbnail: string | null;
  updatedAt: number;
}

const KEY = 'p3m.projects.v1';

export function newProjectId(): string {
  return `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** All saved projects, newest first. */
export function getProjects(): Project[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Project[];
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function write(list: Project[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false; // quota exceeded / unavailable
  }
}

/** Insert or update a project by id. Returns false if storage failed (e.g. quota). */
export function saveProject(project: Project): boolean {
  const list = getProjects();
  const i = list.findIndex((p) => p.id === project.id);
  if (i >= 0) list[i] = project;
  else list.push(project);
  return write(list);
}

export function deleteProject(id: string): void {
  write(getProjects().filter((p) => p.id !== id));
}

export function renameProject(id: string, name: string): void {
  const list = getProjects();
  const p = list.find((x) => x.id === id);
  if (!p) return;
  p.name = name;
  p.updatedAt = Date.now();
  write(list);
}
