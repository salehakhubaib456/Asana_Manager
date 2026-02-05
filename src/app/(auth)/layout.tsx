"use client";

import Link from "next/link";
import { ROUTES } from "@/constants";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-gradient-to-b from-[#e8d5f2] via-[#d4c8f0] to-[#c5d8f5]">
        {/* Abstract shapes - glassmorphism background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[10%] right-[15%] w-32 h-32 bg-blue-400/30 rounded-2xl rotate-12 blur-sm" />
          <div className="absolute top-[20%] right-[25%] w-16 h-16 bg-white/50 rounded-lg rotate-[-20deg] blur-[1px]" />
          <div className="absolute bottom-[25%] left-[10%] w-40 h-40 border-[20px] border-indigo-300/25 rounded-full blur-sm" />
          <div className="absolute bottom-[15%] left-[30%] w-24 h-24 bg-slate-700/20 rounded-3xl rotate-45 blur-sm" />
          <div className="absolute top-[50%] left-[5%] w-20 h-32 bg-violet-300/20 rounded-full blur-sm rotate-[-15deg]" />
          <div className="absolute top-[60%] right-[10%] w-28 h-28 bg-blue-300/25 rounded-2xl blur-sm rotate-12" />
          <div className="absolute top-[15%] left-[20%] w-12 h-12 bg-white/40 rounded-full blur-sm" />
        </div>

        <main className="relative flex-1 flex items-start justify-center pt-6 pb-4 px-4 z-10">
          <div className="w-full max-w-lg">{children}</div>
        </main>

        <footer className="relative text-center py-4 text-xs text-slate-600 z-10">
          © Asanamanager · Project management made simple
        </footer>
      </div>
  );
}
