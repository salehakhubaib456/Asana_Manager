"use client";

import Link from "next/link";
import { ROUTES } from "@/constants";
import { useAuthStore } from "@/store";
import { Button } from "@/components/ui";

export function Header() {
  const { user, logout } = useAuthStore();

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
            <Button variant="ghost" size="sm" onClick={() => logout()}>
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
