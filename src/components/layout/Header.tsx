"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ROUTES } from "@/constants";
import { useAuthStore } from "@/store";
import { authService } from "@/services/authService";
import { Button } from "@/components/ui";

const AUTH_PATHS: string[] = [ROUTES.LOGIN, ROUTES.SIGNUP, ROUTES.FORGOT_PASSWORD, ROUTES.RESET_PASSWORD];

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const isAuthPage = AUTH_PATHS.includes(pathname);
  const isLandingPage = pathname === ROUTES.HOME;

  async function handleLogout() {
    try {
      await authService.logout();
    } finally {
      authService.clearToken();
      logout();
      router.push(ROUTES.HOME);
    }
  }

  // Violet navbar only in app area (dashboard + sidebar). Landing / login / signup / forgot-password stay original.
  const isAppArea = user && !isLandingPage && !isAuthPage;

  return (
    <header
      className={
        isAppArea
          ? "h-14 border-b border-violet-700/30 bg-violet-600 flex items-center justify-between px-6 shadow-md"
          : "h-16 border-b border-white/30 bg-white/50 backdrop-blur-md flex items-center justify-between px-6 shadow-sm"
      }
    >
      <Link
        href={ROUTES.HOME}
        className={
          isAppArea
            ? "text-xl font-bold tracking-tight text-white hover:text-violet-100 transition-colors"
            : "text-xl font-bold tracking-tight text-slate-800 hover:text-violet-700 transition-colors"
        }
      >
        Asanamanager
      </Link>
      <nav className="flex items-center gap-5">
        {user && !isLandingPage && !isAuthPage ? (
          <>
            <Link href={ROUTES.DASHBOARD} className="text-sm font-medium text-white/90 hover:text-white transition-colors">
              Dashboard
            </Link>
            <span className="text-sm text-white/70 max-w-[160px] truncate">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-white/90 hover:text-white hover:bg-violet-500 rounded-lg">
              Logout
            </Button>
          </>
        ) : isAuthPage ? (
          <Link
            href={ROUTES.HOME}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-violet-700 bg-violet-100 hover:bg-violet-200 border border-violet-200 shadow-sm hover:shadow-md transition-all"
          >
            ← Back
          </Link>
        ) : (
          <>
            <Link href={ROUTES.LOGIN}>
              <Button variant="ghost" size="sm" className="text-slate-700 hover:text-violet-700 hover:bg-white/60 rounded-lg">
                Login
              </Button>
            </Link>
            <Link href={ROUTES.SIGNUP}>
              <Button variant="primary" size="sm" className="rounded-lg bg-slate-800 hover:bg-slate-900 text-white">
                Sign up
              </Button>
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
