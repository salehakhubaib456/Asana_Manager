"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Space } from "@/types";
import { projectService } from "@/services/projectService";
import { useProjectStore } from "@/store";
import { ROUTES } from "@/constants";

interface CreateListModalProps {
  onClose: () => void;
  onSuccess: () => void;
  spaces: Space[];
  /** When opened from a space's + menu, preselect this space */
  defaultSpaceId: number | null;
}

export function CreateListModal({
  onClose,
  onSuccess,
  spaces,
  defaultSpaceId,
}: CreateListModalProps) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [spaceId, setSpaceId] = useState<number | null>(defaultSpaceId);
  const [makePrivate, setMakePrivate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { addProject } = useProjectStore();

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    setSpaceId(defaultSpaceId ?? null);
    setName("");
    setDescription("");
    setMakePrivate(false);
    setError("");
  }, [defaultSpaceId]);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a list name.");
      return;
    }
    setError("");
    setCreating(true);
    try {
      const project = await projectService.create({
        name: trimmed,
        description: description.trim() || null,
        status: "on_track",
        space_id: spaceId ?? null,
        folder_id: null,
        is_public: !makePrivate,
      });
      await projectService.update(project.id, { settings: { defaultView: "list" } });
      addProject({ ...project, settings: { defaultView: "list" } });
      onSuccess();
      onClose();
      router.push(`${ROUTES.PROJECT_DETAIL(project.id)}?view=list`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create list");
    } finally {
      setCreating(false);
    }
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-list-title"
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h2 id="create-list-title" className="text-xl font-semibold text-slate-900">
              Create List
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <span className="text-xl leading-none">×</span>
            </button>
          </div>

          <p className="text-sm text-slate-600 mb-4">
            All Lists are located within a Space. Lists can house any type of task.
          </p>

          <div className="space-y-4">
            <div>
              <label htmlFor="list-name" className="block text-sm font-medium text-slate-700 mb-1">
                Name
              </label>
              <input
                id="list-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Project, List of items, Campaign"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="list-desc" className="block text-sm font-medium text-slate-700 mb-1">
                Description
              </label>
              <textarea
                id="list-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell us a bit about your List (optional)"
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none resize-none"
              />
            </div>

            <div>
              <label htmlFor="list-space" className="block text-sm font-medium text-slate-700 mb-1">
                Space (location)
              </label>
              <select
                id="list-space"
                value={spaceId ?? ""}
                onChange={(e) => setSpaceId(e.target.value === "" ? null : Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none bg-white"
              >
                <option value="">My Workspace</option>
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name.charAt(0).toUpperCase()} {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-700">Make private</div>
                <div className="text-xs text-slate-500">Only you and invited members have access.</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={makePrivate}
                onClick={() => setMakePrivate((p) => !p)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 ${
                  makePrivate ? "border-violet-600 bg-violet-600" : "border-slate-200 bg-slate-100"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                    makePrivate ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Use Templates
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!name.trim() || creating}
              className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-50 disabled:pointer-events-none"
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
