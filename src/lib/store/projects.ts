"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Diagram, DiagramType, Project } from "@/lib/uml/types";
import { createDiagram, createProject, newId, touch } from "@/lib/uml/factory";
import { buildExample } from "@/lib/uml/examples";
import { DIAGRAM_TYPE_LABELS } from "@/lib/uml/types";

const HISTORY_LIMIT = 100;

interface History {
  past: Diagram[];
  future: Diagram[];
}

interface ProjectState {
  projects: Project[];
  /** Undo/redo stacks per diagram; kept in memory only. */
  history: Record<string, History>;
  createProject: (name: string, description?: string, withExamples?: boolean) => string;
  updateProject: (id: string, patch: Partial<Pick<Project, "name" | "description" | "requirements">>) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => string | undefined;
  importProject: (project: Project) => string;
  addDiagram: (projectId: string, type: DiagramType, name?: string, fromExample?: boolean) => string;
  deleteDiagram: (projectId: string, diagramId: string) => void;
  renameDiagram: (projectId: string, diagramId: string, name: string) => void;
  /** Applies a change and records it in undo history. */
  commitDiagram: (projectId: string, diagram: Diagram) => void;
  /** Applies a change without an undo entry (e.g. continuous drag). */
  replaceDiagram: (projectId: string, diagram: Diagram) => void;
  undo: (projectId: string, diagramId: string) => void;
  redo: (projectId: string, diagramId: string) => void;
}

function mapProject(projects: Project[], id: string, fn: (p: Project) => Project) {
  return projects.map((p) => (p.id === id ? touch(fn(p)) : p));
}

function findDiagram(projects: Project[], projectId: string, diagramId: string) {
  return projects.find((p) => p.id === projectId)?.diagrams.find((d) => d.id === diagramId);
}

function withDiagram(projects: Project[], projectId: string, diagram: Diagram) {
  return mapProject(projects, projectId, (p) => ({
    ...p,
    diagrams: p.diagrams.map((d) => (d.id === diagram.id ? diagram : d)),
  }));
}

export const useProjects = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      history: {},

      createProject: (name, description = "", withExamples = false) => {
        const project = createProject(name, description);
        if (withExamples) {
          project.diagrams = (["class", "useCase", "sequence", "activity"] as DiagramType[]).map((t) => buildExample(t));
          project.requirements =
            "REQ-001: Customers browse products and add them to a cart.\nREQ-002: Customers place orders from their cart and pay by card or wallet.\nREQ-003: Payment processing and inventory reservation happen in parallel after an order is validated.";
        }
        set({ projects: [project, ...get().projects] });
        return project.id;
      },

      updateProject: (id, patch) => set({ projects: mapProject(get().projects, id, (p) => ({ ...p, ...patch })) }),

      deleteProject: (id) => set({ projects: get().projects.filter((p) => p.id !== id) }),

      duplicateProject: (id) => {
        const src = get().projects.find((p) => p.id === id);
        if (!src) return;
        const copy: Project = JSON.parse(JSON.stringify(src));
        copy.id = newId("prj");
        copy.name = `${src.name} (copy)`;
        copy.diagrams = copy.diagrams.map((d) => ({ ...d, id: newId("dgm") }));
        copy.createdAt = copy.updatedAt = new Date().toISOString();
        set({ projects: [copy, ...get().projects] });
        return copy.id;
      },

      importProject: (project) => {
        const copy: Project = { ...project, id: newId("prj"), updatedAt: new Date().toISOString() };
        set({ projects: [copy, ...get().projects] });
        return copy.id;
      },

      addDiagram: (projectId, type, name, fromExample = false) => {
        const base = createDiagram(type, name || DIAGRAM_TYPE_LABELS[type]);
        const diagram = fromExample ? buildExample(type, base) : base;
        set({ projects: mapProject(get().projects, projectId, (p) => ({ ...p, diagrams: [...p.diagrams, diagram] })) });
        return diagram.id;
      },

      deleteDiagram: (projectId, diagramId) =>
        set({ projects: mapProject(get().projects, projectId, (p) => ({ ...p, diagrams: p.diagrams.filter((d) => d.id !== diagramId) })) }),

      renameDiagram: (projectId, diagramId, name) => {
        const d = findDiagram(get().projects, projectId, diagramId);
        if (d) get().commitDiagram(projectId, { ...d, name });
      },

      commitDiagram: (projectId, diagram) => {
        const prev = findDiagram(get().projects, projectId, diagram.id);
        const h = get().history[diagram.id] ?? { past: [], future: [] };
        const next = touch(diagram);
        set({
          projects: withDiagram(get().projects, projectId, next),
          history: prev
            ? { ...get().history, [diagram.id]: { past: [...h.past, prev].slice(-HISTORY_LIMIT), future: [] } }
            : get().history,
        });
      },

      replaceDiagram: (projectId, diagram) => set({ projects: withDiagram(get().projects, projectId, diagram) }),

      undo: (projectId, diagramId) => {
        const h = get().history[diagramId];
        const cur = findDiagram(get().projects, projectId, diagramId);
        if (!h || h.past.length === 0 || !cur) return;
        const prev = h.past[h.past.length - 1];
        set({
          projects: withDiagram(get().projects, projectId, prev),
          history: { ...get().history, [diagramId]: { past: h.past.slice(0, -1), future: [cur, ...h.future] } },
        });
      },

      redo: (projectId, diagramId) => {
        const h = get().history[diagramId];
        const cur = findDiagram(get().projects, projectId, diagramId);
        if (!h || h.future.length === 0 || !cur) return;
        const [next, ...rest] = h.future;
        set({
          projects: withDiagram(get().projects, projectId, next),
          history: { ...get().history, [diagramId]: { past: [...h.past, cur], future: rest } },
        });
      },
    }),
    {
      name: "uml-studio-ai:v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ projects: s.projects }),
      skipHydration: true,
    },
  ),
);
