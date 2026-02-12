import { create } from "zustand";
import { STORAGE_KEYS } from "@/constants";
import type { FavoriteItem } from "@/lib/favorites";

export interface FavoritesState {
  favorites: FavoriteItem[];
  loadFromStorage: () => void;
  addFavorite: (item: FavoriteItem) => void;
  removeFavorite: (type: FavoriteItem["type"], id: number) => void;
}

function readFavorites(): FavoriteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.FAVORITES);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FavoriteItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFavorites(list: FavoriteItem[]) {
  if (typeof window !== "undefined") sessionStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(list));
}

export const useFavoritesStore = create<FavoritesState>((set) => ({
  favorites: [],
  loadFromStorage: () => set({ favorites: readFavorites() }),
  addFavorite: (item) =>
    set((s) => {
      if (s.favorites.some((f) => f.type === item.type && f.id === item.id)) return s;
      const next = [...s.favorites, item];
      writeFavorites(next);
      return { favorites: next };
    }),
  removeFavorite: (type, id) =>
    set((s) => {
      const next = s.favorites.filter((f) => !(f.type === type && f.id === id));
      writeFavorites(next);
      return { favorites: next };
    }),
}));
