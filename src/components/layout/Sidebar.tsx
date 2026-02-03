"use client";

import Link from "next/link";
import { ROUTES } from "@/constants";
import { useUIStore } from "@/store";

export function Sidebar() {
  const { sidebarOpen } = useUIStore();

  if (!sidebarOpen) return null;

  return (
    <aside className="w-56 border-r border-gray-200 bg-gray-50 min-h-[calc(100vh-3.5rem)] py-4">
      <nav className="px-3 space-y-1">
        <Link
          href={ROUTES.DASHBOARD}
          className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Dashboard
        </Link>
        <Link
          href={ROUTES.PROJECTS}
          className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Projects
        </Link>
        <Link
          href={ROUTES.TASKS}
          className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Tasks
        </Link>
      </nav>
    </aside>
  );
}
