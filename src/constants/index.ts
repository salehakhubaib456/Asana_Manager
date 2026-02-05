/**
 * App-wide constants – routes, enums, config keys.
 */

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",
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
    GOOGLE: "/api/auth/google",
    FORGOT_PASSWORD: "/api/auth/forgot-password",
    VERIFY_RESET_OTP: "/api/auth/verify-reset-otp",
    RESET_PASSWORD: "/api/auth/reset-password",
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
