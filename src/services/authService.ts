import { apiPost, apiGet } from "./api";
import { API_ROUTES, STORAGE_KEYS } from "@/constants";
import type { User } from "@/types";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken?: string;
}

export const authService = {
  login: (payload: LoginPayload) =>
    apiPost<AuthResponse>(API_ROUTES.AUTH.LOGIN, payload),
  signup: (payload: SignupPayload) =>
    apiPost<AuthResponse>(API_ROUTES.AUTH.SIGNUP, payload),
  me: () => apiGet<User>(API_ROUTES.AUTH.ME),
  logout: () => apiPost<{ ok: boolean }>(API_ROUTES.AUTH.LOGOUT, {}),

  persistToken: (token: string) => {
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  },
  clearToken: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  },
};
