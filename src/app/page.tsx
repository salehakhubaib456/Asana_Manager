import Link from "next/link";
import { ROUTES } from "@/constants";
import { Button } from "@/components/ui";

export default function Home() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900">Asanamanager</h1>
      <p className="mt-4 text-gray-600">
        Next.js + MySQL + TypeScript. Project management with state management (Zustand).
      </p>
      <div className="mt-6 flex gap-4">
        <Link href={ROUTES.LOGIN}>
          <Button variant="secondary">Login</Button>
        </Link>
        <Link href={ROUTES.SIGNUP}>
          <Button variant="primary">Sign up</Button>
        </Link>
        <Link href={ROUTES.DASHBOARD}>
          <Button variant="ghost">Dashboard</Button>
        </Link>
      </div>
      <p className="mt-8 text-sm text-gray-500">
        API: <a href="/api/health" className="text-blue-600 hover:underline">/api/health</a>
        {" "}| <a href="/api/users" className="text-blue-600 hover:underline">/api/users</a>
      </p>
    </main>
  );
}
