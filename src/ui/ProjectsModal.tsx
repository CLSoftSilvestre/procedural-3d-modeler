import { useState } from 'react';
import { useStore } from '@/state/store';
import type { Graph } from '@/graph/types';
import {
  getProjects,
  saveProject,
  deleteProject,
  renameProject,
  newProjectId,
  type Project,
} from '@/state/projects';
import { Icon } from './Icon';

interface ProjectsModalProps {
  onOpen: (graph: Graph, name: string) => void;
  onInsert: (project: Project) => void;
  captureThumbnail: () => Promise<string | null>;
  onClose: () => void;
}

/** Local project library: save the current model under a name, then reopen/manage it later. */
export function ProjectsModal({ onOpen, onInsert, captureThumbnail, onClose }: ProjectsModalProps) {
  const [projects, setProjects] = useState<Project[]>(() => getProjects());
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const refresh = () => setProjects(getProjects());

  async function saveCurrent() {
    const trimmed = name.trim() || 'Untitled';
    const thumbnail = await captureThumbnail();
    const ok = saveProject({
      id: newProjectId(),
      name: trimmed,
      graph: useStore.getState().graph,
      thumbnail,
      updatedAt: Date.now(),
    });
    if (!ok) {
      setError('Could not save — local storage is full. Delete a project and retry.');
      return;
    }
    setName('');
    setError(null);
    refresh();
  }

  async function overwrite(p: Project) {
    const thumbnail = await captureThumbnail();
    const ok = saveProject({
      ...p,
      graph: useStore.getState().graph,
      thumbnail,
      updatedAt: Date.now(),
    });
    if (!ok) setError('Could not save — local storage is full.');
    else refresh();
  }

  function duplicate(p: Project) {
    saveProject({ ...p, id: newProjectId(), name: `${p.name} copy`, updatedAt: Date.now() });
    refresh();
  }

  function rename(p: Project) {
    const next = prompt('Rename project', p.name);
    if (next && next.trim()) {
      renameProject(p.id, next.trim());
      refresh();
    }
  }

  function remove(p: Project) {
    if (confirm(`Delete project “${p.name}”? This can't be undone.`)) {
      deleteProject(p.id);
      refresh();
    }
  }

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div className="modal__tabs">
            <button className="is-active">Projects</button>
          </div>
          <div className="modal__actions">
            <input
              className="projects__name"
              placeholder="New project name…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void saveCurrent()}
            />
            <button className="toolbar__primary" onClick={() => void saveCurrent()}>
              <Icon name="save" /> Save current
            </button>
            <button onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="projects">
          {error && <div className="modal__error">{error}</div>}
          {projects.length === 0 ? (
            <div className="panel__empty">
              No saved projects yet. Name your model above and click “Save current”.
            </div>
          ) : (
            <div className="projects__grid">
              {projects.map((p) => (
                <div className="projcard" key={p.id}>
                  <button
                    className="projcard__open"
                    title="Open this project"
                    onClick={() => onOpen(p.graph, p.name)}
                  >
                    {p.thumbnail ? (
                      <img className="projcard__thumb" src={p.thumbnail} alt="" />
                    ) : (
                      <div className="projcard__thumb projcard__thumb--empty">no preview</div>
                    )}
                  </button>
                  <div className="projcard__meta">
                    <span className="projcard__name" title={p.name}>
                      {p.name}
                    </span>
                    <span className="projcard__date">{new Date(p.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="projcard__actions">
                    <button
                      title="Insert into the current model as a component"
                      onClick={() => onInsert(p)}
                    >
                      <Icon name="plus" size={13} />
                    </button>
                    <button title="Save current model into this project" onClick={() => void overwrite(p)}>
                      <Icon name="save" size={13} />
                    </button>
                    <button title="Duplicate" onClick={() => duplicate(p)}>
                      <Icon name="duplicate" size={13} />
                    </button>
                    <button title="Rename" onClick={() => rename(p)}>
                      <Icon name="edit" size={13} />
                    </button>
                    <button className="iconbtn--danger" title="Delete" onClick={() => remove(p)}>
                      <Icon name="delete" size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
