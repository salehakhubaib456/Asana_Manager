import { LandingContent } from "@/components/features/LandingContent";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#e8d5f2] via-[#d4c8f0] to-[#c5d8f5] relative overflow-hidden">
      {/* Background shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] right-[15%] w-32 h-32 bg-blue-400/20 rounded-2xl rotate-12 blur-sm" />
        <div className="absolute bottom-[20%] left-[10%] w-40 h-40 border-[20px] border-indigo-300/20 rounded-full blur-sm" />
        <div className="absolute top-[50%] left-[5%] w-20 h-32 bg-violet-300/20 rounded-full blur-sm rotate-[-15deg]" />
      </div>
      <LandingContent />
    </main>
  );
}
