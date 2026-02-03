import { create } from "zustand";
import type { Project, Section } from "@/types";

export interface ProjectState {
  currentProject: Project | null;
  projects: Project[];
  sections: Section[];
  setCurrentProject: (project: Project | null) => void;
  setProjects: (projects: Project[]) => void;
  setSections: (sections: Section[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: number, updates: Partial<Project>) => void;
  reset: () => void;
}

const initialState = {
  currentProject: null,
  projects: [],
  sections: [],
};

export const useProjectStore = create<ProjectState>((set) => ({
  ...initialState,
  setCurrentProject: (currentProject) => set({ currentProject }),
  setProjects: (projects) => set({ projects }),
  setSections: (sections) => set({ sections }),
  addProject: (project) =>
    set((s) => ({ projects: [...s.projects, project] })),
  updateProject: (id, updates) =>
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      currentProject:
        s.currentProject?.id === id
          ? { ...s.currentProject, ...updates }
          : s.currentProject,
    })),
  reset: () => set(initialState),
}));
