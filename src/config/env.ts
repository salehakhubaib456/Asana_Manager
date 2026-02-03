/**
 * Typed env – use this instead of process.env directly in app code.
 */

export const env = {
  get NODE_ENV(): "development" | "production" | "test" {
    return (process.env.NODE_ENV ?? "development") as "development" | "production" | "test";
  },
  get NEXT_PUBLIC_APP_URL(): string {
    return process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== "undefined" ? window.location.origin : "");
  },
} as const;
