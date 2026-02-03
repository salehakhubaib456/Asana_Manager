/**
 * App-wide constants – routes, enums, config keys.
 */

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  DASHBOARD: "/dashboard",
  PROJECTS: "/dashboard/projects",
  TASKS: "/dashboard/tasks",
} as const;

export const API_ROUTES = {
  HEALTH: "/api/health",
  AUTH: {
    LOGIN: "/api/auth/login",
    SIGNUP: "/api/auth/signup",
    LOGOUT: "/api/auth/logout",
    ME: "/api/auth/me",
  },
  USERS: "/api/users",
  PROJECTS: "/api/projects",
  TASKS: "/api/tasks",
  SECTIONS: "/api/sections",
} as const;

export const STORAGE_KEYS = {
  TOKEN: "asanamanager_token",
  REFRESH_TOKEN: "asanamanager_refresh_token",
  USER: "asanamanager_user",
} as const;
