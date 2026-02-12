"use client";

import { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ROUTES } from "@/constants";
import { useUIStore, useAuthStore, useProjectStore, useFavoritesStore } from "@/store";
import { projectService } from "@/services/projectService";
import { folderService } from "@/services/folderService";
import { spaceService } from "@/services/spaceService";
import { CreateSpaceModal } from "./CreateSpaceModal";
import { CreateListModal } from "./CreateListModal";
import type { Project, Folder, Space } from "@/types";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarOpen } = useUIStore();
  const { user } = useAuthStore();
  const { projects, setProjects } = useProjectStore();
  const { favorites, loadFromStorage, removeFavorite } = useFavoritesStore();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [createSpaceOpen, setCreateSpaceOpen] = useState(false);
  // Which menu is open: "workspace" or a specific space id
  const [createMenuFor, setCreateMenuFor] = useState<"workspace" | number | null>(null);
  const [createType, setCreateType] = useState<"list" | "folder" | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createListModalOpen, setCreateListModalOpen] = useState(false);
  const [createListDefaultSpaceId, setCreateListDefaultSpaceId] = useState<number | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [expandedSpaces, setExpandedSpaces] = useState<Set<number>>(new Set());
  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const workspaceTriggerRef = useRef<HTMLButtonElement>(null);
  const spaceRowRef = useRef<HTMLDivElement>(null);
  const [createMenuPosition, setCreateMenuPosition] = useState<{ left: number; top: number } | null>(null);

  const workspaceName = user?.workspace_name?.trim() || user?.name?.trim() || "My Workspace";

  useLayoutEffect(() => {
    if (createMenuFor === null) {
      setCreateMenuPosition(null);
      return;
    }
    const trigger = createMenuFor === "workspace" ? workspaceTriggerRef.current : createTriggerRef.current;
    if (!trigger) {
      setCreateMenuPosition(null);
      return;
    }
    const b = trigger.getBoundingClientRect();
    const left = b.right + 4;
    const top = typeof createMenuFor === "number" && spaceRowRef.current
      ? spaceRowRef.current.getBoundingClientRect().top
      : b.top;
    setCreateMenuPosition({ left, top });
  }, [createMenuFor]);

  const loadData = useCallback(async () => {
    try {
      const [projectList, folderList, spaceList] = await Promise.all([
        projectService.list(),
        folderService.list().catch(() => [] as Folder[]),
        spaceService.list().catch(() => [] as Space[]),
      ]);
      setProjects(projectList);
      setFolders(folderList);
      setSpaces(spaceList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [setProjects]);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const rootProjects = projects.filter((p) => p.folder_id == null);
  const foldersInDefault = folders.filter((f) => f.space_id == null);
  const projectsByFolderDefault = foldersInDefault.map((f) => ({
    folder: f,
    projects: projects.filter((p) => p.folder_id === f.id),
  }));
  const projectsBySpace = spaces.map((space) => ({
    space,
    folders: folders.filter((f) => f.space_id === space.id),
  }));
  const toggleSpace = (id: number) => {
    setExpandedSpaces((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFolder = (id: number) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || createType !== "folder") return;
    setCreating(true);
    try {
      const spaceIdForCreate = typeof createMenuFor === "number" ? createMenuFor : null;
      await folderService.create({ name, space_id: spaceIdForCreate });
      setCreateMenuFor(null);
      setNewName("");
      setCreateType(null);
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const openCreate = (type: "list" | "folder") => {
    const spaceId = typeof createMenuFor === "number" ? createMenuFor : null;
    setCreateMenuFor(null);
    if (type === "list") {
      setCreateType(null);
      setCreateListDefaultSpaceId(spaceId);
      setCreateListModalOpen(true);
      return;
    }
    setCreateType("folder");
    setNewName("");
  };

  if (!sidebarOpen) return null;

  return (
    <aside className="w-64 border-r border-violet-100 bg-violet-50/80 backdrop-blur-md min-h-[calc(100vh-3.5rem)] py-4 flex flex-col">
      {/* Favorites */}
      <section className="px-3 mb-4">
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Favorites</span>
        </div>
        {favorites.length === 0 ? (
          <p className="text-xs text-slate-500 italic">Click ⭐ to add favorites to your sidebar.</p>
        ) : (
          <ul className="space-y-0.5">
            {favorites.map((fav) => (
              <li key={`${fav.type}-${fav.id}`} className="flex items-center group">
                <Link
                  href={fav.type === "doc" && fav.projectId != null ? `/dashboard/projects/${fav.projectId}?view=doc&docId=${fav.id}` : fav.type === "project" ? ROUTES.PROJECT_DETAIL(fav.id) : ROUTES.DASHBOARD_DETAIL(fav.id)}
                  className="flex-1 min-w-0 px-2 py-1.5 rounded-md text-sm text-slate-700 hover:bg-violet-100/60 truncate"
                >
                  {fav.type === "doc" ? "📄" : fav.type === "project" ? "📋" : "📊"} {fav.name}
                </Link>
                <button
                  type="button"
                  onClick={() => removeFavorite(fav.type, fav.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-violet-600 rounded"
                  aria-label="Remove from favorites"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Spaces */}
      <section className="px-3 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Spaces</span>
          <button
            type="button"
            onClick={() => setCreateSpaceOpen(true)}
            className="p-1 rounded text-slate-500 hover:bg-violet-100/60 hover:text-violet-700"
            aria-label="Create Space"
          >
            +
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Default workspace + List/Folder dropdown */}
          <div className="flex items-center gap-1 group/ws">
            <div className="font-medium text-slate-700 py-1 truncate flex-1 min-w-0" title={workspaceName}>
              {workspaceName}
            </div>
            <div className="relative shrink-0 opacity-0 group-hover/ws:opacity-100">
              <button
                ref={workspaceTriggerRef}
                type="button"
                onClick={() =>
                  setCreateMenuFor((prev) => (prev === "workspace" ? null : "workspace"))
                }
                className="p-1 rounded text-slate-500 hover:bg-violet-100/60 hover:text-violet-700"
                aria-label="Create Folders, Lists, Docs and more"
                title="Create Folders, Lists, Docs and more"
              >
                +
              </button>
              {createMenuFor === "workspace" && null}
            </div>
          </div>
          {loading ? (
            <p className="text-xs text-slate-500">Loading...</p>
          ) : (
            <div className="space-y-0.5 mt-1">
              {rootProjects.map((p) => (
                <Link
                  key={p.id}
                  href={ROUTES.PROJECT_DETAIL(p.id)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm truncate ${
                    pathname === ROUTES.PROJECT_DETAIL(p.id)
                      ? "bg-violet-100 text-violet-800"
                      : "text-slate-700 hover:bg-violet-100/60"
                  }`}
                >
                  <span>📋</span> {p.name}
                </Link>
              ))}
              {projectsByFolderDefault.map(({ folder, projects: folderProjects }) => (
                <div key={folder.id}>
                  <button
                    type="button"
                    onClick={() => toggleFolder(folder.id)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm text-slate-700 hover:bg-violet-100/60 text-left"
                  >
                    <span className="text-slate-400">
                      {expandedFolders.has(folder.id) ? "▼" : "▶"}
                    </span>
                    <span>📁</span>
                    <span className="truncate flex-1">{folder.name}</span>
                    <span className="text-xs text-slate-400">{folderProjects.length}</span>
                  </button>
                  {expandedFolders.has(folder.id) && (
                    <div className="pl-4 ml-1 border-l border-slate-200">
                      {folderProjects.map((p) => (
                        <Link
                          key={p.id}
                          href={ROUTES.PROJECT_DETAIL(p.id)}
                          className={`flex items-center gap-2 px-2 py-1 rounded-md text-sm truncate block ${
                            pathname === ROUTES.PROJECT_DETAIL(p.id)
                              ? "bg-violet-100 text-violet-800"
                              : "text-slate-600 hover:bg-violet-100/50"
                          }`}
                        >
                          <span>📋</span> {p.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {projectsBySpace.map(({ space, folders: spaceFolders }) => (
                <div key={space.id}>
                  <div
                    ref={createMenuFor === space.id ? spaceRowRef : undefined}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSpace(space.id)}
                    onKeyDown={(e) => e.key === "Enter" && toggleSpace(space.id)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm text-slate-700 hover:bg-violet-100/60 text-left group/space cursor-pointer"
                  >
                    <span className="text-slate-400">
                      {expandedSpaces.has(space.id) ? "▼" : "▶"}
                    </span>
                    <span className="truncate flex-1">{space.name}</span>
                    <div className="relative opacity-0 group-hover/space:opacity-100 shrink-0">
                      <button
                        ref={createMenuFor === space.id ? createTriggerRef : undefined}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCreateMenuFor((prev) => (prev === space.id ? null : space.id));
                        }}
                        className="p-1 rounded text-slate-500 hover:bg-violet-100/60 hover:text-violet-700"
                        aria-label="Create Folders, Lists, Docs and more"
                        title="Create Folders, Lists, Docs and more"
                      >
                        +
                      </button>
                      {createMenuFor === space.id && null}
                    </div>
                  </div>
                  {expandedSpaces.has(space.id) && (
                    <div className="pl-3 ml-1 border-l border-slate-200">
                      {projects
                        .filter((p) => p.space_id === space.id && p.folder_id == null)
                        .map((p) => (
                          <Link
                            key={p.id}
                            href={ROUTES.PROJECT_DETAIL(p.id)}
                            className={`flex items-center gap-2 px-2 py-1 rounded-md text-sm truncate block ${
                              pathname === ROUTES.PROJECT_DETAIL(p.id)
                                ? "bg-violet-100 text-violet-800"
                                : "text-slate-600 hover:bg-violet-100/50"
                            }`}
                          >
                            <span>📋</span> {p.name}
                          </Link>
                        ))}
                      {spaceFolders.map((f) => {
                        const folderProjects = projects.filter((p) => p.folder_id === f.id);
                        return (
                          <div key={f.id}>
                            <button
                              type="button"
                              onClick={() => toggleFolder(f.id)}
                              className="flex items-center gap-2 w-full px-2 py-1 rounded-md text-sm text-slate-600 hover:bg-violet-100/50 text-left"
                            >
                              <span className="text-slate-400">{expandedFolders.has(f.id) ? "▼" : "▶"}</span>
                              <span>📁</span>
                              <span className="truncate flex-1">{f.name}</span>
                              <span className="text-xs text-slate-400">{folderProjects.length}</span>
                            </button>
                            {expandedFolders.has(f.id) && (
                              <div className="pl-4">
                                {folderProjects.map((p) => (
                                  <Link
                                    key={p.id}
                                    href={ROUTES.PROJECT_DETAIL(p.id)}
                                    className={`flex items-center gap-2 px-2 py-1 rounded-md text-sm truncate block ${
                                      pathname === ROUTES.PROJECT_DETAIL(p.id)
                                        ? "bg-violet-100 text-violet-800"
                                        : "text-slate-600 hover:bg-violet-100/50"
                                    }`}
                                  >
                                    <span>📋</span> {p.name}
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {spaceFolders.length === 0 &&
                        projects.filter((p) => p.space_id === space.id && p.folder_id == null).length === 0 && (
                          <p className="px-2 py-1 text-xs text-slate-500">No lists or folders yet</p>
                        )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <Link
          href={ROUTES.DASHBOARD}
          className={`mt-2 px-2 py-1.5 rounded-md text-sm ${
            pathname === ROUTES.DASHBOARD ? "bg-violet-100 text-violet-800" : "text-slate-700 hover:bg-violet-100/60"
          }`}
        >
          📊 Dashboard
        </Link>
        <Link
          href={ROUTES.PROJECTS}
          className="px-2 py-1.5 rounded-md text-sm text-slate-700 hover:bg-violet-100/60"
        >
          All Projects
        </Link>
        <Link
          href={ROUTES.TASKS}
          className="px-2 py-1.5 rounded-md text-sm text-slate-700 hover:bg-violet-100/60"
        >
          Tasks
        </Link>
      </section>

      {/* Create Folder modal (inline prompt) */}
      {createType === "folder" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-xl p-4 w-full max-w-sm">
            <h3 className="font-semibold text-slate-800 mb-2">New Folder</h3>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Folder name"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg mb-3 focus:ring-2 focus:ring-violet-500 outline-none"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setCreateType(null)}
                className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
              >
                {creating ? "..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
      {createListModalOpen && (
        <CreateListModal
          onClose={() => setCreateListModalOpen(false)}
          onSuccess={() => loadData()}
          spaces={spaces}
          defaultSpaceId={createListDefaultSpaceId}
        />
      )}
      {createSpaceOpen && (
        <CreateSpaceModal
          onClose={() => setCreateSpaceOpen(false)}
          onSuccess={() => loadData()}
        />
      )}

      {/* Create menu in portal so it appears on top of sidebar + main content */}
      {createMenuFor !== null &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[9998]"
              aria-hidden
              onClick={() => setCreateMenuFor(null)}
            />
            <div
              className="fixed z-[9999] bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-[192px]"
              style={createMenuPosition ? { left: createMenuPosition.left, top: createMenuPosition.top } : undefined}
            >
              <div className="px-2.5 py-1.5 text-xs font-semibold text-slate-500 border-b border-slate-100">Create</div>
              <button type="button" onClick={() => openCreate("list")} className="w-full px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                <span className="text-slate-500">📋</span> List
              </button>
              <button type="button" onClick={() => openCreate("folder")} className="w-full px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                <span className="text-slate-500">📁</span> Folder
              </button>
              <button type="button" disabled className="w-full px-2.5 py-1.5 text-left text-sm text-slate-500 opacity-70 flex items-center gap-2">
                <span className="text-slate-400">🔄</span> Sprint Folder
              </button>
              <div className="border-t border-slate-100 my-1" />
              <button type="button" onClick={() => { setCreateMenuFor(null); router.push(ROUTES.PROJECTS); }} className="w-full px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                <span className="text-slate-500">📄</span> Doc
              </button>
              <button type="button" onClick={() => { setCreateMenuFor(null); router.push(ROUTES.DASHBOARD); }} className="w-full px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                <span className="text-slate-500">📊</span> Dashboard
              </button>
              <button type="button" disabled className="w-full px-2.5 py-1.5 text-left text-sm text-slate-500 opacity-70 flex items-center gap-2">
                <span className="text-slate-400">✏️</span> Whiteboard
              </button>
              <button type="button" disabled className="w-full px-2.5 py-1.5 text-left text-sm text-slate-500 opacity-70 flex items-center gap-2">
                <span className="text-slate-400">☑</span> Form
              </button>
              <div className="border-t border-slate-100 my-1" />
              <button type="button" disabled className="w-full px-2.5 py-1.5 text-left text-sm text-slate-500 opacity-70 flex items-center gap-2">
                <span className="text-slate-400">↓</span> Imports <span className="ml-auto">›</span>
              </button>
              <button type="button" disabled className="w-full px-2.5 py-1.5 text-left text-sm text-slate-500 opacity-70 flex items-center gap-2">
                <span className="text-slate-400">✨</span> Templates
              </button>
            </div>
          </>,
          document.body
        )}
    </aside>
  );
}
