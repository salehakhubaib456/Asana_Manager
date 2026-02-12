"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

const WORKFLOW_TEMPLATES = [
  { id: "starter", title: "Starter", subtitle: "For everyday tasks.", defaultViews: "List, Board", taskStatuses: "TO DO → IN PROGRESS → COMPLETE", clickApps: "Tags, Time Estimates, Priority, Time Tracking, Incomplete Warning,..." },
  { id: "marketing", title: "Marketing Teams", subtitle: "Run effective campaigns.", defaultViews: "List, Board, Calendar, Team", taskStatuses: "BACKLOG → PLANNING → IN PROGRESS → READY", clickApps: "Tags, Time Estimates, Priority, Time Tracking, Incomplete Warning,..." },
  { id: "project_management", title: "Project Management", subtitle: "Plan, manage, and execute projects.", defaultViews: "List, Board, Calendar, Gantt, Team", taskStatuses: "TO DO → PLANNING → IN PROGRESS → AT RISK", clickApps: "Tags, Time Estimates, Priority, Time Tracking, Incomplete Warning,..." },
  { id: "product_engineering", title: "Product + Engineering", subtitle: "Streamline your product lifecycle.", defaultViews: "List, Board, Timeline, Table, Workload", taskStatuses: "BACKLOG → SCOPING → IN DESIGN → IN DEVELOPMENT", clickApps: "Tags, Time Estimates, Priority, Time Tracking, Incomplete Warning,..." },
] as const;

type WorkflowId = (typeof WORKFLOW_TEMPLATES)[number]["id"];

interface CreateSpaceModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateSpaceModal({ onClose, onSuccess }: CreateSpaceModalProps) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultPermission, setDefaultPermission] = useState("full_edit");
  const [isPrivate, setIsPrivate] = useState(false);
  const [workflow, setWorkflow] = useState<WorkflowId>("starter");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setMounted(true), []);

  function goNext() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a space name.");
      return;
    }
    setError("");
    setStep(2);
  }

  async function handleCreateSpace() {
    setCreating(true);
    setError("");
    try {
      const { spaceService } = await import("@/services/spaceService");
      await spaceService.create({
        name: name.trim(),
        description: description.trim() || undefined,
        default_permission: defaultPermission,
        is_private: isPrivate,
      });
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create space");
    } finally {
      setCreating(false);
    }
  }

  const selectedTemplate = WORKFLOW_TEMPLATES.find((t) => t.id === workflow) ?? WORKFLOW_TEMPLATES[0];

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={step === 1 ? "create-space-title" : "define-workflow-title"}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl w-full max-h-[90vh] overflow-y-auto ${step === 1 ? "max-w-lg" : "max-w-2xl"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 id={step === 1 ? "create-space-title" : "define-workflow-title"} className="text-xl font-semibold text-slate-900">
                {step === 1 ? "Create a Space" : "Define your workflow"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {step === 1
                  ? "A Space represents teams, departments, or groups, each with their own Lists, workflows, and settings."
                  : "Choose a pre-configured solution or customize to your liking with advanced ClickApps, required views, and task statuses."}
              </p>
            </div>
            <button type="button" onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100" aria-label="Close">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {step === 1 ? (
            <>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Icon & name</label>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-medium shrink-0">S</div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Marketing, Engineering, HR"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this space for?"
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none resize-none"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="text-sm font-medium text-slate-700">Default permission</span>
                    <span className="text-slate-400" title="Members can edit by default">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                  </div>
                  <select value={defaultPermission} onChange={(e) => setDefaultPermission(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none">
                    <option value="full_edit">Full edit</option>
                    <option value="comment">Comment</option>
                    <option value="view">View only</option>
                  </select>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div>
                    <div className="text-sm font-medium text-slate-700">Make Private</div>
                    <div className="text-xs text-slate-500">Only you and invited members have access.</div>
                  </div>
                  <button type="button" role="switch" aria-checked={isPrivate} onClick={() => setIsPrivate((p) => !p)} className={`relative w-11 h-6 rounded-full transition-colors ${isPrivate ? "bg-violet-600" : "bg-slate-200"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isPrivate ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
              </div>
              {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
              <div className="mt-6 flex justify-end">
                <button type="button" onClick={goNext} disabled={!name.trim()} className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none">
                  Next
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {WORKFLOW_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setWorkflow(t.id)}
                    className={`text-left p-4 rounded-lg border-2 transition-colors ${
                      workflow === t.id ? "border-slate-800 bg-slate-50" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="font-medium text-slate-900">{t.title}</div>
                    <div className="text-sm text-slate-500 mt-0.5">{t.subtitle}</div>
                  </button>
                ))}
              </div>
              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-sm font-medium text-slate-700 mb-3">Customize defaults for {selectedTemplate.title}</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50/50">
                    <span className="text-slate-500">📄</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800">Default views</div>
                      <div className="text-xs text-slate-500">{selectedTemplate.defaultViews}</div>
                    </div>
                    <span className="text-slate-400">›</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50/50">
                    <span className="text-slate-500">◎</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800">Task statuses</div>
                      <div className="text-xs text-slate-500">{selectedTemplate.taskStatuses}</div>
                    </div>
                    <span className="text-slate-400">›</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50/50">
                    <span className="text-slate-500">▣</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800">ClickApps</div>
                      <div className="text-xs text-slate-500">{selectedTemplate.clickApps}</div>
                    </div>
                    <span className="text-slate-400">›</span>
                  </div>
                </div>
              </div>
              {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
              <div className="mt-6 flex justify-between">
                <button type="button" onClick={() => setStep(1)} className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium">
                  Back
                </button>
                <button type="button" onClick={handleCreateSpace} disabled={creating} className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none">
                  {creating ? "Creating..." : "Create Space"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);
}
