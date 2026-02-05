"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { ROUTES } from "@/constants";
import { useAuthStore } from "@/store";
import { authService } from "@/services/authService";
import { useGoogleReady } from "./GoogleProvider";

interface GoogleButtonProps {
  mode: "login" | "signup";
  onError?: (msg: string) => void;
  disabled?: boolean;
}

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export function GoogleButton({ mode, onError, disabled }: GoogleButtonProps) {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const googleReady = useGoogleReady();

  function handleClick() {
    if (!clientId) {
      (onError ?? console.warn)("Google Sign-In is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env");
      return;
    }
    if (typeof window === "undefined" || !window.google?.accounts?.oauth2) {
      (onError ?? console.warn)("Google sign-in didn't load. Please refresh the page and try again.");
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "email profile openid",
      callback: async (res) => {
        if (!res.access_token) return;
        try {
          const data = await authService.loginWithGoogle(res.access_token);
          authService.persistToken(data.token);
          authService.persistUser(data.user);
          setAuth(data.user, data.token);
          router.push(ROUTES.DASHBOARD);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Google sign-in failed";
          onError?.(msg);
        }
      },
    });

    // Opens Google popup: account picker (all Chrome/Google accounts) then consent
    tokenClient.requestAccessToken({ prompt: "select_account" });
  }

  const isDisabled = disabled || (!!clientId && !googleReady);

  return (
    <Button
      type="button"
      variant="secondary"
      className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 bg-white/90 border border-slate-200 hover:bg-white text-slate-700 shadow-sm"
      disabled={isDisabled}
      onClick={handleClick}
      title={!clientId ? "Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable" : mode === "login" ? "Continue with Google" : "Sign up with Google"}
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      {isDisabled && clientId ? "Loading…" : mode === "login" ? "Continue with Google" : "Sign up with Google"}
    </Button>
  );
}
