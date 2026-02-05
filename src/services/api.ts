/**
 * Base API client – fetch wrapper, auth header, error handling.
 */

import { STORAGE_KEYS } from "@/constants";
import type { ApiError } from "@/types";

const getToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
};

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const d = data as ApiError & { details?: string; emailRegistered?: boolean };
    const errMsg = d?.details ?? d?.error ?? res.statusText;
    const err = new Error(typeof errMsg === "string" ? errMsg : "Request failed") as Error & { emailRegistered?: boolean };
    err.emailRegistered = d?.emailRegistered;
    throw err;
  }

  return data as T;
}

export const apiGet = <T>(path: string) => api<T>(path, { method: "GET" });
export const apiPost = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const apiPut = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PUT", body: JSON.stringify(body) });
export const apiPatch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const apiDelete = <T>(path: string) =>
  api<T>(path, { method: "DELETE" });
