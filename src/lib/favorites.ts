import { STORAGE_KEYS } from "@/constants";

export type FavoriteType = "project" | "dashboard" | "doc";

export interface FavoriteItem {
  type: FavoriteType;
  id: number;
  name: string;
  /** When type is "doc", link is /dashboard/projects/{projectId}?view=doc&docId={id} */
  projectId?: number;
}

export function getFavorites(): FavoriteItem[] {
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

export function addFavorite(item: FavoriteItem): void {
  const list = getFavorites();
  if (list.some((f) => f.type === item.type && f.id === item.id)) return;
  list.push(item);
  if (typeof window !== "undefined") sessionStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(list));
}

export function removeFavorite(type: FavoriteType, id: number): void {
  const list = getFavorites().filter((f) => !(f.type === type && f.id === id));
  if (typeof window !== "undefined") sessionStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(list));
}

export function isFavorite(type: FavoriteType, id: number): boolean {
  return getFavorites().some((f) => f.type === type && f.id === id);
}

export function toggleFavorite(item: FavoriteItem): boolean {
  const exists = isFavorite(item.type, item.id);
  if (exists) {
    removeFavorite(item.type, item.id);
    return false;
  }
  addFavorite(item);
  return true;
}
