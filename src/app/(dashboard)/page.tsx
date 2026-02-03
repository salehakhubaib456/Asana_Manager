import Link from "next/link";
import { ROUTES } from "@/constants";
import { Card } from "@/components/ui";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-2 text-gray-600">Overview and quick links.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link href={ROUTES.PROJECTS}>
          <Card className="hover:border-blue-300 transition-colors cursor-pointer">
            <h3 className="font-medium text-gray-900">Projects</h3>
            <p className="mt-1 text-sm text-gray-500">View and manage projects</p>
          </Card>
        </Link>
        <Link href={ROUTES.TASKS}>
          <Card className="hover:border-blue-300 transition-colors cursor-pointer">
            <h3 className="font-medium text-gray-900">Tasks</h3>
            <p className="mt-1 text-sm text-gray-500">View and manage tasks</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
