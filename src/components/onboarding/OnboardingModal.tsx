"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/store";
import { authService } from "@/services/authService";
import { apiPost } from "@/services/api";
import { API_ROUTES } from "@/constants";
import type { User } from "@/types";

const STEPS = [
  { id: "useCase", title: "What would you like to use Asanamanager for?" },
  { id: "manage", title: "What would you like to manage?" },
  { id: "invite", title: "Invite people to your Workspace:" },
  { id: "workspaceName", title: "Lastly, what would you like to name your Workspace?" },
] as const;

const USE_CASES = [
  { id: "work", label: "Work" },
  { id: "personal", label: "Personal" },
  { id: "school", label: "School" },
] as const;

const MANAGE_OPTIONS = [
  "Support",
  "Marketing",
  "Finance & Accounting",
  "Operations",
  "Creative & Design",
  "IT",
  "HR & Recruiting",
  "PMO",
  "Startup",
  "Sales & CRM",
  "Personal Use",
  "Software Development",
  "Professional Services",
  "Other",
];

function getStepIndex(stepId: string): number {
  const i = STEPS.findIndex((s) => s.id === stepId);
  return i >= 0 ? i : 0;
}

interface OnboardingModalProps {
  user: User;
  onComplete: () => void;
}

export function OnboardingModal({ user, onComplete }: OnboardingModalProps) {
  const { setUser } = useAuthStore();
  const [stepIndex, setStepIndex] = useState(0);
  const [useCase, setUseCase] = useState<string | null>(null);
  const [manageTypes, setManageTypes] = useState<string[]>([]);
  const [invitedEmails, setInvitedEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [workspaceName, setWorkspaceName] = useState(
    () => `${user?.name?.trim() || user?.email?.split("@")[0] || "User"}'s Workspace`
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stepId = STEPS[stepIndex]?.id ?? "useCase";
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;
  const isInviteStep = stepId === "invite";

  const toggleManage = useCallback((label: string) => {
    setManageTypes((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    );
  }, []);

  const addEmail = useCallback(() => {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    if (!invitedEmails.includes(email)) setInvitedEmails((p) => [...p, email]);
    setEmailInput("");
  }, [emailInput, invitedEmails]);

  const removeEmail = useCallback((email: string) => {
    setInvitedEmails((p) => p.filter((e) => e !== email));
  }, []);

  const goNext = useCallback(() => {
    if (isInviteStep) {
      // Next from invite: go to workspace name (invites sent on Finish)
      setStepIndex((i) => i + 1);
      return;
    }
    if (isLast) {
      submit();
      return;
    }
    setStepIndex((i) => i + 1);
  }, [isInviteStep, isLast]);

  const goSkip = useCallback(() => {
    if (!isInviteStep) return;
    setInvitedEmails([]);
    setStepIndex((i) => i + 1);
  }, [isInviteStep]);

  const goBack = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const name = workspaceName.trim() || `${user?.name || "User"}'s Workspace`;
      await apiPost<{ ok: boolean; projectId?: number; workspaceName?: string }>(
        API_ROUTES.AUTH.ONBOARDING_COMPLETE,
        {
          workspaceName: name,
          useCase: useCase || null,
          manageTypes: manageTypes.length > 0 ? manageTypes : null,
          invitedEmails: invitedEmails.length > 0 ? invitedEmails : null,
        }
      );
      const updated = await authService.me();
      setUser(updated);
      authService.persistUser(updated);
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const canNext =
    stepId === "useCase"
      ? !!useCase
      : stepId === "manage"
        ? true
        : stepId === "invite"
          ? true
          : !!workspaceName?.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-2 flex items-center justify-between border-b border-slate-200">
          <span className="text-lg font-semibold text-violet-700">Asanamanager</span>
          {user?.name && (
            <span className="text-sm text-slate-500">Welcome, {user.name}!</span>
          )}
        </div>

        <div className="px-6 py-6 overflow-y-auto flex-1">
          <h2 className="text-xl font-semibold text-slate-800 mb-6">
            {STEPS[stepIndex]?.title}
          </h2>

          {stepId === "useCase" && (
            <div className="flex flex-wrap gap-3">
              {USE_CASES.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setUseCase(opt.id)}
                  className={`px-5 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                    useCase === opt.id
                      ? "border-violet-600 bg-violet-50 text-violet-800"
                      : "border-slate-200 bg-white text-slate-700 hover:border-violet-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {stepId === "manage" && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                {MANAGE_OPTIONS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleManage(label)}
                    className={`px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                      manageTypes.includes(label)
                        ? "border-violet-600 bg-violet-50 text-violet-800"
                        : "border-slate-200 bg-white text-slate-700 hover:border-violet-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">Don&apos;t worry, you can always add more later.</p>
            </>
          )}

          {stepId === "invite" && (
            <>
              <div className="space-y-2 mb-2">
                <input
                  type="email"
                  placeholder="Enter email addresses (or paste multiple)"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                />
                <p className="text-xs text-slate-500">Press Enter to add</p>
              </div>
              {invitedEmails.length > 0 && (
                <ul className="flex flex-wrap gap-2 mb-3">
                  {invitedEmails.map((email) => (
                    <li
                      key={email}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-sm text-slate-700"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => removeEmail(email)}
                        className="text-slate-400 hover:text-red-600"
                        aria-label={`Remove ${email}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-sm text-emerald-600 flex items-center gap-1">
                <span aria-hidden>💡</span> Don&apos;t do it alone — invite your team to get started faster.
              </p>
            </>
          )}

          {stepId === "workspaceName" && (
            <>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g. Acme Inc. Workspace"
                className="w-full px-4 py-3 mb-2 border-2 border-slate-200 rounded-lg bg-white text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none box-border"
                aria-label="Workspace name"
              />
              <p className="text-xs text-slate-500">Try the name of your company or organization.</p>
            </>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-4">
          <div className="flex gap-2">
            {!isFirst && (
              <Button variant="secondary" onClick={goBack} disabled={loading}>
                ← Back
              </Button>
            )}
            {isInviteStep && (
              <Button variant="ghost" onClick={goSkip} disabled={loading}>
                Skip
              </Button>
            )}
          </div>
          <Button
            variant="primary"
            onClick={goNext}
            disabled={!canNext || loading}
            isLoading={loading}
          >
            {isLast ? "Finish" : "Next →"}
          </Button>
        </div>

        <div className="h-1 flex bg-slate-100">
          <div
            className="h-full bg-violet-600 transition-all duration-300"
            style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
