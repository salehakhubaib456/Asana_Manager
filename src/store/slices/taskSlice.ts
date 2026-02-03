import { create } from "zustand";
import type { Task } from "@/types";

export interface TaskState {
  tasks: Task[];
  selectedTaskId: number | null;
  setTasks: (tasks: Task[]) => void;
  setSelectedTaskId: (id: number | null) => void;
  addTask: (task: Task) => void;
  updateTask: (id: number, updates: Partial<Task>) => void;
  removeTask: (id: number) => void;
  reset: () => void;
}

const initialState = {
  tasks: [],
  selectedTaskId: null,
};

export const useTaskStore = create<TaskState>((set) => ({
  ...initialState,
  setTasks: (tasks) => set({ tasks }),
  setSelectedTaskId: (selectedTaskId) => set({ selectedTaskId }),
  addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),
  updateTask: (id, updates) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  removeTask: (id) =>
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
      selectedTaskId: s.selectedTaskId === id ? null : s.selectedTaskId,
    })),
  reset: () => set(initialState),
}));
