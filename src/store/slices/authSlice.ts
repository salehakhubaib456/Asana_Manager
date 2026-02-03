import { create } from "zustand";
import type { User } from "@/types";

export interface AuthState {
  user: User | null;
  token: string | null;
  isHydrated: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setAuth: (user: User | null, token: string | null) => void;
  logout: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isHydrated: false,
  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setAuth: (user, token) => set({ user, token }),
  logout: () => set({ user: null, token: null }),
  setHydrated: () => set({ isHydrated: true }),
}));
