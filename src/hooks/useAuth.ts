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
    if (typeof window === "undefined") {
      setHydrated();
      return;
    }
    let stored = localStorage.getItem(STORAGE_KEYS.TOKEN);
    let storedUser = localStorage.getItem(STORAGE_KEYS.USER);
    if (!stored && sessionStorage.getItem(STORAGE_KEYS.TOKEN)) {
      stored = sessionStorage.getItem(STORAGE_KEYS.TOKEN);
      storedUser = sessionStorage.getItem(STORAGE_KEYS.USER);
      if (stored) localStorage.setItem(STORAGE_KEYS.TOKEN, stored);
      if (storedUser) localStorage.setItem(STORAGE_KEYS.USER, storedUser);
    }
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
