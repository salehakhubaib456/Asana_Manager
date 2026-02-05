"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store";
import { authService } from "@/services/authService";
import { STORAGE_KEYS } from "@/constants";

/**
 * Hydrate auth from storage on mount; use useAuthStore for state.
 */
export function useAuthHydrate() {
  const { setAuth, setHydrated, token, user } = useAuthStore();

  useEffect(() => {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEYS.TOKEN) : null;
    const storedUser = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEYS.USER) : null;
    if (stored && storedUser) {
      try {
        setAuth(JSON.parse(storedUser), stored);
      } catch {
        // ignore
      }
    }
    setHydrated();
  }, [setAuth, setHydrated]);
}

export { useAuthStore } from "@/store";
