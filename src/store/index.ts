/**
 * Central store – re-export all slices.
 * State management: Zustand (lazmi use kiya gaya hai).
 */

export { useAuthStore } from "./slices/authSlice";
export { useProjectStore } from "./slices/projectSlice";
export { useTaskStore } from "./slices/taskSlice";
export { useUIStore, type ViewMode } from "./slices/uiSlice";
