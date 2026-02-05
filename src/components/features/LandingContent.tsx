"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/constants";
import { Button } from "@/components/ui";

const CATEGORIES = [
  { name: "Marketing", icon: "📢" },
  { name: "Operations", icon: "⚙️" },
  { name: "Software", icon: "💻" },
  { name: "Design", icon: "🎨" },
  { name: "Finance", icon: "💰" },
  { name: "Prof Services", icon: "📋" },
  { name: "Sales & CRM", icon: "📊" },
  { name: "Other", icon: "✨" },
];

export function LandingContent() {
  const [selected, setSelected] = useState<string | null>(null);

  const select = (name: string) => {
    setSelected((prev) => (prev === name ? null : name));
  };

  return (
    <>
      <section className="relative z-10 max-w-4xl mx-auto px-6 pt-8 pb-4 text-center">
        <p className="text-violet-600 font-bold text-base md:text-lg uppercase tracking-wider mb-3">
          AI-driven project management system
        </p>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-800 tracking-tight mb-6">
          One place for every project
        </h1>
        <p className="text-lg md:text-xl text-slate-700 max-w-2xl mx-auto font-medium leading-relaxed">
          Manage your projects, docs, and chat all in one place—with AI that helps your team get more done, faster.
        </p>
      </section>

      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-2 pb-4">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800 text-center mb-8">
          What kind of work do you want to manage?
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {CATEGORIES.map((cat) => {
            const isChecked = selected === cat.name;
            const isDimmed = selected !== null && !isChecked;
            return (
              <button
                key={cat.name}
                type="button"
                onClick={() => select(cat.name)}
                className={`bg-white/60 backdrop-blur-sm border-2 rounded-2xl p-5 shadow-sm hover:bg-white/80 hover:shadow-md transition-all cursor-pointer flex flex-col items-center justify-center min-h-[120px] relative text-left focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-transparent ${
                  isChecked ? "border-violet-500" : "border-white/60"
                } ${isDimmed ? "opacity-50" : ""}`}
              >
                <span className="text-2xl mb-2">{cat.icon}</span>
                <span className="font-semibold text-slate-800 text-center">{cat.name}</span>
                <span
                  className={`absolute top-3 right-3 w-4 h-4 rounded border-2 flex items-center justify-center ${
                    isChecked
                      ? "border-violet-600 bg-violet-600 text-white"
                      : "border-slate-300"
                  }`}
                >
                  {isChecked && (
                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="relative z-10 max-w-2xl mx-auto px-6 pt-4 pb-10 text-center">
        <Link href={ROUTES.SIGNUP}>
          <Button
            className="w-full max-w-md mx-auto rounded-xl py-4 text-lg font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg"
          >
            Get Started. It&apos;s FREE →
          </Button>
        </Link>
      </section>
    </>
  );
}
