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
  firstName?: string;
  lastName?: string;
  name?: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  email: string;
  otp: string;
  newPassword: string;
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
  loginWithGoogle: (access_token: string) =>
    apiPost<AuthResponse>(API_ROUTES.AUTH.GOOGLE, { access_token }),
  forgotPassword: (payload: ForgotPasswordPayload) =>
    apiPost<{ message: string }>(API_ROUTES.AUTH.FORGOT_PASSWORD, payload),
  verifyResetOtp: (payload: { email: string; otp: string }) =>
    apiPost<{ ok: boolean }>(API_ROUTES.AUTH.VERIFY_RESET_OTP, payload),
  resetPassword: (payload: ResetPasswordPayload) =>
    apiPost<{ message: string }>(API_ROUTES.AUTH.RESET_PASSWORD, payload),

  persistToken: (token: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
      sessionStorage.removeItem(STORAGE_KEYS.TOKEN);
    }
  },
  persistUser: (user: User) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      sessionStorage.removeItem(STORAGE_KEYS.USER);
    }
  },
  clearToken: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
      sessionStorage.removeItem(STORAGE_KEYS.TOKEN);
      sessionStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      sessionStorage.removeItem(STORAGE_KEYS.USER);
    }
  },
};
