import dynamic from "next/dynamic";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";

const Sidebar = dynamic(() => import("@/components/layout").then(mod => ({ default: mod.Sidebar })), {
  ssr: false,
});

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] bg-white">
      <OnboardingGate />
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  );
}
