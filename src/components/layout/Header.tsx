"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/constants";
import { useAuthStore } from "@/store";
import { authService } from "@/services/authService";
import { Button } from "@/components/ui";

export function Header() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  async function handleLogout() {
    try {
      await authService.logout();
    } finally {
      authService.clearToken();
      logout();
      router.push(ROUTES.HOME);
    }
  }

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-4">
      <Link href={ROUTES.HOME} className="font-semibold text-gray-900">
        Asanamanager
      </Link>
      <nav className="flex items-center gap-4">
        {user ? (
          <>
            <Link href={ROUTES.DASHBOARD} className="text-sm text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            <span className="text-sm text-gray-500">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </>
        ) : (
          <>
            <Link href={ROUTES.LOGIN}>
              <Button variant="ghost" size="sm">
                Login
              </Button>
            </Link>
            <Link href={ROUTES.SIGNUP}>
              <Button variant="primary" size="sm">
                Sign up
              </Button>
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
