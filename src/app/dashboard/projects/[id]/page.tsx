"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useSearchParams } from "next/navigation";
import { Card, Button, Input } from "@/components/ui";
import { projectService } from "@/services/projectService";
import { taskService } from "@/services/taskService";
import { authService } from "@/services/authService";
import { apiGet, getAuthHeaders } from "@/services/api";
import { useFavoritesStore } from "@/store";
import type { Project, Section, Task, ProjectMember, MemberRole, TaskPriority, TaskStatus, TaskType, User } from "@/types";

type ViewType = "overview" | "board" | "list" | "calendar" | "gantt" | "table" | "doc";

export default function ProjectDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = Number(params.id);
  const [project, setProject] = useState<Project | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewType>("board");
  const [userRole, setUserRole] = useState<MemberRole | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [projectDocs, setProjectDocs] = useState<Array<{ id: number; title: string }>>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [stats, setStats] = useState<{
    total_tasks: number;
    completed_tasks: number;
    on_track_tasks: number;
    waiting_tasks: number;
    overdue_tasks: number;
    progress_percentage: number;
  } | null>(null);

  // Toast when task marked complete: show "Status changed" + Undo (Ctrl+Z)
  const [completedUndo, setCompletedUndo] = useState<{ taskId: number; previousStatus: TaskStatus } | null>(null);

  // Toast for invite/accept and share messages (used in main layout; setToast passed to ListView)
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  // When set, ListView opens the "Add task" row in this section (e.g. To Do) – used by "+ Add Task" in list view
  const [openAddTaskInSectionId, setOpenAddTaskInSectionId] = useState<number | null>(null);

  // Create task form state
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium" as TaskPriority,
    assignee_id: null as number | null,
    due_date: "",
    section_id: null as number | null,
  });

  useEffect(() => {
    if (!projectId) return;
    loadData();
  }, [projectId]);

  const viewTypes: ViewType[] = ["overview", "board", "list", "calendar", "gantt", "table", "doc"];

  // URL view param (e.g. ?view=list or ?view=doc&docId=123)
  useEffect(() => {
    const view = searchParams.get("view");
    const docIdParam = searchParams.get("docId");
    const docId = docIdParam ? Number(docIdParam) : NaN;
    if (view === "doc" && Number.isInteger(docId) && docId > 0) {
      setCurrentView("doc");
      setSelectedDocId(docId);
      return;
    }
    if (view && viewTypes.includes(view as ViewType)) {
      setCurrentView(view as ViewType);
      if (view !== "doc") setSelectedDocId(null);
    }
  }, [searchParams]);

  // When project loads: if no view in URL, use project default (e.g. list created from Create List opens in List view)
  useEffect(() => {
    if (!project || searchParams.get("view")) return;
    const defaultView = project.settings && typeof project.settings === "object" && "defaultView" in project.settings
      ? (project.settings as { defaultView?: string }).defaultView
      : undefined;
    if (defaultView && viewTypes.includes(defaultView as ViewType)) {
      setCurrentView(defaultView as ViewType);
    }
  }, [project, searchParams]);

  // Undo completed task: Ctrl+Z when toast is visible
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!completedUndo) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        handleUpdateTask(completedUndo.taskId, { status: completedUndo.previousStatus });
        setCompletedUndo(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [completedUndo]);

  // Accept invite when landing with ?invite=TOKEN (project-level; runs regardless of view)
  const inviteToken = searchParams.get("invite");
  useEffect(() => {
    if (!projectId || !inviteToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/invite/accept?token=${encodeURIComponent(inviteToken)}`, { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data.loginRequired) {
          const returnUrl = encodeURIComponent(window.location.pathname + "?invite=" + inviteToken);
          window.location.href = `/login?returnUrl=${returnUrl}`;
          return;
        }
        if (!res.ok) {
          setToast({ message: data.error || "Invalid or expired invitation", error: true });
          window.history.replaceState({}, "", window.location.pathname + (window.location.search.replace(/\?invite=[^&]+&?|&?invite=[^&]+/, "").replace(/\?$/, "") || "?"));
          return;
        }
        setToast({ message: "You've joined this project." });
        window.history.replaceState({}, "", window.location.pathname + (window.location.search.replace(/\?invite=[^&]+&?|&?invite=[^&]+/, "").replace(/\?$/, "") || "?"));
        loadData();
      } catch {
        if (!cancelled) setToast({ message: "Failed to accept invitation", error: true });
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, inviteToken]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function loadData() {
    try {
      // Load data completely sequentially to avoid connection pool exhaustion
      const projectData = await projectService.getById(projectId);
      setProject(projectData);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
      const sectionsData = await projectService.getSections(projectId);
      setSections(sectionsData.sort((a, b) => a.position - b.position));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      const tasksData = await taskService.listByProject(projectId);
      
      // Ensure tasks in "Done" section have status="completed"
      const doneSection = sectionsData.find((s: Section) => s.name.toLowerCase().trim() === "done");
      if (doneSection) {
        const tasksToUpdate = tasksData.filter((t: Task) => 
          t.section_id === doneSection.id && t.status !== "completed"
        );
        // Update tasks in Done section to have status="completed"
        for (const task of tasksToUpdate) {
          try {
            await taskService.update(task.id, { status: "completed" });
            console.log(`Updated task ${task.id} in Done section to status=completed`);
          } catch (err) {
            console.error(`Failed to update task ${task.id} status:`, err);
          }
        }
        // Reload tasks if any were updated
        if (tasksToUpdate.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
          const refreshedTasks = await taskService.listByProject(projectId);
          setTasks(refreshedTasks);
        } else {
          setTasks(tasksData);
        }
      } else {
        setTasks(tasksData);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      const membersData = await projectService.getMembers(projectId);
      setMembers(membersData);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      const statsData = await projectService.getStats(projectId).catch(() => null);
      setStats(statsData);

      const docsRes = await fetch(`/api/projects/${projectId}/docs`, { headers: getAuthHeaders() }).catch(() => null);
      if (docsRes?.ok) {
        const docsData = await docsRes.json();
        setProjectDocs(docsData.map((d: { id: number; title: string }) => ({ id: d.id, title: d.title || "Untitled" })));
      } else {
        setProjectDocs([]);
      }
      
      // Find current user's role
      try {
        await new Promise(resolve => setTimeout(resolve, 100));
        const me = await authService.me();
        setCurrentUser(me);
        const myMember = membersData.find((m: ProjectMember) => m.user_id === me.id);
        setUserRole(myMember?.role || null);
      } catch {}
    } catch (err) {
      console.error("Error loading project data:", err);
      if (err instanceof Error && (err.message.includes("Too many connections") || err.message.includes("connection limit"))) {
        // Retry after delay
        setTimeout(() => {
          loadData();
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTask() {
    if (!newTask.title.trim() || !newTask.section_id) return;
    try {
      // Format dates to YYYY-MM-DD format
      const formatDate = (date: string | null | undefined): string | null => {
        if (!date || date === "") return null;
        // If it's already in YYYY-MM-DD format, return as is
        if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return date;
        }
        // Convert Date object or date string to YYYY-MM-DD
        try {
          const d = new Date(date);
          if (isNaN(d.getTime())) return null;
          return d.toISOString().split("T")[0];
        } catch {
          return null;
        }
      };

      await taskService.create({
        project_id: projectId,
        section_id: newTask.section_id,
        title: newTask.title.trim(),
        description: newTask.description.trim() || null,
        priority: newTask.priority,
        assignee_id: newTask.assignee_id,
        due_date: formatDate(newTask.due_date),
      });
      await loadData();
      setShowCreateTask(false);
      setNewTask({
        title: "",
        description: "",
        priority: "medium",
        assignee_id: null,
        due_date: "",
        section_id: null,
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteTask(taskId: number) {
    try {
      await taskService.delete(taskId);
      await loadData();
      if (selectedTask?.id === taskId) setSelectedTask(null);
    } catch (e) {
      console.error("Delete task failed:", e);
    }
  }

  async function handleUpdateTask(taskId: number, updates: Partial<Task>) {
    try {
      // Format dates properly - convert to YYYY-MM-DD format or null
      const formatDate = (date: string | null | undefined | Date): string | null => {
        if (!date || date === "") return null;
        // If it's already in YYYY-MM-DD format, return as is
        if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return date;
        }
        // Handle Date objects
        if (date instanceof Date) {
          if (isNaN(date.getTime())) return null;
          return date.toISOString().split("T")[0];
        }
        // Convert date string to YYYY-MM-DD
        try {
          const d = new Date(date);
          if (isNaN(d.getTime())) return null;
          return d.toISOString().split("T")[0];
        } catch {
          return null;
        }
      };

      const formattedUpdates: Partial<Task> = { ...updates };

      // Only format dates if they're present in updates
      if (updates.due_date !== undefined) {
        formattedUpdates.due_date = formatDate(updates.due_date as string | null);
      }
      if (updates.start_date !== undefined) {
        formattedUpdates.start_date = formatDate(updates.start_date as string | null);
      }

      console.log("Updating task:", taskId, formattedUpdates);
      await taskService.update(taskId, formattedUpdates);
      
      // Reload all data to ensure UI is in sync, including stats
      await loadData();
      
      // Explicitly reload stats after task update to ensure progress is updated
      try {
        const freshStats = await projectService.getStats(projectId);
        setStats(freshStats);
      } catch (err) {
        console.error("Error refreshing stats:", err);
      }
      
      // Update selected task if it's the one being edited
      if (selectedTask?.id === taskId) {
        const updatedTask = await taskService.getById(taskId);
        setSelectedTask(updatedTask);
      }
    } catch (err) {
      console.error("Error updating task:", err);
      throw err; // Re-throw to let caller handle error
    }
  }

  function getTasksBySection(sectionId: number) {
    return tasks.filter((t) => t.section_id === sectionId);
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "on_track":
        return "bg-green-200 text-green-800 border-green-300";
      case "at_risk":
        return "bg-yellow-200 text-yellow-800 border-yellow-300";
      case "off_track":
        return "bg-red-200 text-red-800 border-red-300";
      default:
        return "bg-slate-200 text-slate-700 border-slate-300";
    }
  }

  function getPriorityColor(priority: TaskPriority) {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-slate-100 text-slate-800 border-slate-300";
    }
  }

  function getAssigneeName(assigneeId: number | null) {
    if (!assigneeId) return null;
    const member = members.find((m) => m.user_id === assigneeId);
    return member?.user?.name || member?.user?.email || "Unknown";
  }

  function isOverdue(dueDate: string | null) {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <p className="text-red-600">Project not found</p>
      </div>
    );
  }

  const canEditProject = userRole === "owner" || userRole === "admin";

  const isListView = currentView === "list";
  return (
    <div className={isListView ? "flex flex-col min-h-0" : "flex flex-col h-[calc(100vh-3.5rem)]"}>
      {/* Project Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">{project.name}</h1>
            {project.description && (
              <p className="mt-1 text-sm text-slate-600">{project.description}</p>
            )}
          </div>
        </div>

        {/* View Tabs - Doc tab only when project has docs */}
        <div className="flex items-center gap-1 border-b border-slate-200 -mb-4">
          {(["overview", "board", "list", "calendar", "gantt", "table"] as ViewType[]).map((view) => (
            <button
              key={view}
              onClick={() => setCurrentView(view)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
                currentView === view
                  ? "border-violet-600 text-violet-700"
                  : "border-transparent text-slate-600 hover:text-slate-800"
              }`}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
          {projectDocs.length > 0 && (
            <button
              onClick={() => setCurrentView("doc")}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
                currentView === "doc"
                  ? "border-violet-600 text-violet-700"
                  : "border-transparent text-slate-600 hover:text-slate-800"
              }`}
            >
              <span className="text-base">📄</span>
              Doc
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area - List view: no inner scroll (only window scroll); other views: scroll inside */}
      <div
        className={
          isListView
            ? `flex flex-col ${currentView === "doc" && selectedDocId ? "p-2" : "p-6"}`
            : `flex-1 overflow-auto flex flex-col min-h-0 ${currentView === "doc" && selectedDocId ? "p-2" : "p-6"}`
        }
      >
        {currentView === "overview" && (
          <OverviewView
            projectId={projectId}
            project={project}
            projectDocs={projectDocs}
            stats={stats}
            sections={sections}
            tasks={tasks}
            members={members}
            onRefresh={loadData}
            onUpdateProject={async (updates) => {
              await projectService.update(projectId, updates);
              await loadData();
            }}
            onAddDoc={async (docId, title) => {
              setProjectDocs((prev) => [...prev, { id: docId, title: title || "Untitled" }]);
              setSelectedDocId(docId);
              setCurrentView("doc");
            }}
            onOpenDoc={(id) => {
              setSelectedDocId(id);
              setCurrentView("doc");
            }}
          />
        )}
        {currentView === "board" && (
          <BoardView
            sections={sections}
            tasks={tasks}
            members={members}
            getTasksBySection={getTasksBySection}
            getPriorityColor={getPriorityColor}
            getAssigneeName={getAssigneeName}
            isOverdue={isOverdue}
            onTaskClick={setSelectedTask}
            onUpdateTask={handleUpdateTask}
            onAddTaskInSection={(sectionId) => {
              setNewTask((prev) => ({ ...prev, section_id: sectionId }));
              setShowCreateTask(true);
            }}
          />
        )}
        {currentView === "list" && (
          <ListView
            tasks={tasks}
            sections={sections}
            members={members}
            getPriorityColor={getPriorityColor}
            getAssigneeName={getAssigneeName}
            isOverdue={isOverdue}
            onTaskClick={setSelectedTask}
            onUpdateTask={handleUpdateTask}
            onTaskMarkedComplete={(taskId, previousStatus) => setCompletedUndo({ taskId, previousStatus })}
            onCreateTask={async (sectionId, title, options) => {
              await taskService.create({
                project_id: projectId,
                section_id: sectionId,
                title: title.trim(),
                description: null,
                priority: options?.priority ?? "medium",
                assignee_id: options?.assignee_id ?? null,
                due_date: options?.due_date ?? null,
              });
              await loadData();
            }}
            projectId={projectId}
            setToast={setToast}
            onDeleteTask={handleDeleteTask}
            openAddTaskInSectionId={openAddTaskInSectionId}
            onOpenAddTaskHandled={() => setOpenAddTaskInSectionId(null)}
          />
        )}
        {currentView === "calendar" && (
          <CalendarView
            tasks={tasks}
            sections={sections}
            members={members}
            getPriorityColor={getPriorityColor}
            getAssigneeName={getAssigneeName}
            isOverdue={isOverdue}
            onTaskClick={setSelectedTask}
          />
        )}
        {currentView === "gantt" && (
          <GanttView
            tasks={tasks}
            sections={sections}
            members={members}
            getPriorityColor={getPriorityColor}
            getAssigneeName={getAssigneeName}
            onTaskClick={setSelectedTask}
            onUpdateTask={handleUpdateTask}
          />
        )}
        {currentView === "table" && (
          <TableView
            tasks={tasks}
            sections={sections}
            members={members}
            getPriorityColor={getPriorityColor}
            getAssigneeName={getAssigneeName}
            isOverdue={isOverdue}
            onTaskClick={setSelectedTask}
            onUpdateTask={handleUpdateTask}
          />
        )}
        {currentView === "doc" && selectedDocId ? (
          <DocEditorModal
            projectId={projectId}
            docId={selectedDocId}
            currentUser={currentUser}
            embedded
            onClose={() => {
              setSelectedDocId(null);
              fetch(`/api/projects/${projectId}/docs`, { headers: getAuthHeaders() })
                .then((r) => r.ok ? r.json() : [])
                .then((data) => setProjectDocs((data || []).map((d: { id: number; title: string }) => ({ id: d.id, title: d.title || "Untitled" }))))
                .catch(() => {});
            }}
            onDocDeleted={(id) => {
              setProjectDocs((prev) => prev.filter((d) => d.id !== id));
              setSelectedDocId(null);
            }}
            onDocDuplicated={(id, title) => {
              setProjectDocs((prev) => [...prev, { id, title }]);
              setSelectedDocId(id);
            }}
          />
        ) : currentView === "doc" ? (
          <DocListView
            projectId={projectId}
            projectDocs={projectDocs}
            onOpenDoc={(id) => {
              setSelectedDocId(id);
            }}
            onAddDoc={async () => {
              try {
                const res = await fetch(`/api/projects/${projectId}/docs`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                  body: JSON.stringify({ title: "Untitled" }),
                });
                if (res.ok) {
                  const doc = await res.json();
                  setProjectDocs((prev) => [...prev, { id: doc.id, title: doc.title || "Untitled" }]);
                  setSelectedDocId(doc.id);
                }
              } catch (e) {
                console.error(e);
              }
            }}
            onRefreshDocs={() => {
              fetch(`/api/projects/${projectId}/docs`, { headers: getAuthHeaders() })
                .then((r) => r.ok ? r.json() : [])
                .then((data) => setProjectDocs((data || []).map((d: { id: number; title: string }) => ({ id: d.id, title: d.title || "Untitled" }))))
                .catch(() => setProjectDocs([]));
            }}
          />
        ) : null}
      </div>

      {/* Create Task Modal */}
      {showCreateTask && (
        <CreateTaskModal
          newTask={newTask}
          setNewTask={setNewTask}
          sections={sections}
          members={members}
          onClose={() => setShowCreateTask(false)}
          onCreate={handleCreateTask}
        />
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          sections={sections}
          members={members}
          currentUser={currentUser}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdateTask}
          projectId={projectId}
        />
      )}

      {/* Toast: task marked complete — Status changed + Undo (Ctrl+Z) */}
      {completedUndo && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-4 px-4 py-3 rounded-lg bg-slate-800 text-white shadow-xl"
          role="status"
        >
          <span className="text-sm font-medium">Status changed</span>
          <button
            type="button"
            onClick={() => {
              handleUpdateTask(completedUndo.taskId, { status: completedUndo.previousStatus });
              setCompletedUndo(null);
            }}
            className="text-sm font-semibold text-white hover:underline"
          >
            Undo
          </button>
          <span className="text-xs text-slate-300 bg-slate-700 px-2 py-0.5 rounded">Ctrl+Z</span>
        </div>
      )}

      {/* Toast: invite / accept messages */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-4 py-3 rounded-lg shadow-xl text-white"
          style={{ backgroundColor: toast.error ? "#b91c1c" : "#334155" }}
          role="status"
        >
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}

// Doc list - shows when Doc tab is selected; click a doc to open editor modal
function DocListView({
  projectId,
  projectDocs,
  onOpenDoc,
  onAddDoc,
}: {
  projectId: number;
  projectDocs: Array<{ id: number; title: string }>;
  onOpenDoc: (id: number) => void;
  onAddDoc?: () => void | Promise<void>;
  onRefreshDocs?: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const handleAdd = async () => {
    if (!onAddDoc) return;
    setAdding(true);
    try {
      await onAddDoc();
    } finally {
      setAdding(false);
    }
  };
  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="border border-slate-200 rounded-xl p-8 bg-white/60">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Docs</h3>
        <p className="text-sm text-slate-600 mb-4">Click a doc to open and edit.</p>
        {projectDocs.length > 0 ? (
          <ul className="space-y-2">
            {projectDocs.map((d) => (
              <li key={d.id} className="group">
                <div className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 text-slate-800 font-medium">
                  <button
                    type="button"
                    onClick={() => onOpenDoc(d.id)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    <span className="text-slate-400">📄</span>
                    {d.title}
                  </button>
                  <a
                    href={`/dashboard/projects/${projectId}?view=doc&docId=${d.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 p-1.5 rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Open in new tab"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </a>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500 mb-4">No docs yet. Add one below.</p>
        )}
        {onAddDoc && (
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding}
            className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            {adding ? "Adding…" : "+ Add a Doc"}
          </button>
        )}
      </div>
    </div>
  );
}

// Doc Editor - full-screen in content area (embedded) or as modal; chips removed; toolbar wired
function DocEditorModal({
  projectId,
  docId,
  currentUser,
  onClose,
  onDocDeleted,
  onDocDuplicated,
  embedded = false,
}: {
  projectId: number;
  docId: number;
  currentUser: User | null;
  onClose: () => void;
  onDocDeleted?: (docId: number) => void;
  onDocDuplicated?: (docId: number, title: string) => void;
  embedded?: boolean;
}) {
  const [doc, setDoc] = useState<{
    id: number;
    title: string;
    content: string;
    updated_at: string;
    author_name: string | null;
    author_email: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localTitle, setLocalTitle] = useState("");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const pageTitleInputRef = useRef<HTMLInputElement>(null);
  const docTitleInputRef = useRef<HTMLInputElement>(null);
  const pageRenameInSidebarRef = useRef<HTMLInputElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const formatToolbarTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLoadedDocIdRef = useRef<number | null>(null);

  const { favorites, addFavorite, removeFavorite } = useFavoritesStore();
  const isFav = favorites.some((f) => f.type === "doc" && f.id === docId);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Array<{ id: string; text: string; at: string }>>([]);
  const [newComment, setNewComment] = useState("");
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"entireDoc" | "thisPage">("entireDoc");
  const [editingPageIndex, setEditingPageIndex] = useState<number | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [formatToolbarOpen, setFormatToolbarOpen] = useState(false);
  const [pages, setPages] = useState<Array<{ title: string; content: string }>>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const loadDoc = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/docs/${docId}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDoc(data);
        setDocTitle(data.title || "Untitled");
        setLocalTitle(data.title || "Untitled");
      } else {
        setDoc(null);
      }
    } catch {
      setDoc(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, docId]);

  useEffect(() => {
    loadDoc();
  }, [loadDoc]);

  const saveDoc = useCallback(
    async (title?: string, content?: string) => {
      if (!doc) return;
      setSaving(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/docs/${docId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            ...(title !== undefined && { title: title || "Untitled" }),
            ...(content !== undefined && { content }),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setDoc(data);
        }
      } finally {
        setSaving(false);
      }
    },
    [projectId, docId, doc]
  );

  const getEditorContent = useCallback(() => {
    return contentEditableRef.current?.innerHTML ?? "";
  }, []);

  const savePagesToServer = useCallback(
    (updatedPages: Array<{ title: string; content: string }>) => {
      if (!doc) return;
      setSaving(true);
      fetch(`/api/projects/${projectId}/docs/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ content: JSON.stringify({ pages: updatedPages }) }),
      })
        .then((r) => r.ok && r.json())
        .then((data) => data && setDoc(data))
        .finally(() => setSaving(false));
    },
    [projectId, docId, doc]
  );

  const saveContentFromEditor = useCallback(() => {
    const html = getEditorContent();
    if (!doc || pages.length === 0) return;
    const updated = [...pages];
    updated[currentPageIndex] = { ...updated[currentPageIndex], content: html };
    setPages(updated);
    savePagesToServer(updated);
  }, [projectId, docId, doc, getEditorContent, pages, currentPageIndex, savePagesToServer]);

  const debouncedSaveContent = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveContentFromEditor();
      saveTimeoutRef.current = null;
    }, 600);
  }, [saveContentFromEditor]);

  const handleDocTitleBlur = () => {
    const t = docTitle.trim() || "Untitled";
    setDocTitle(t);
    saveDoc(t, undefined);
  };

  const handleTitleBlur = () => {
    const t = localTitle.trim() || "Untitled";
    setLocalTitle(t);
    if (pages.length > 0 && currentPageIndex < pages.length) {
      const updated = [...pages];
      updated[currentPageIndex] = { ...updated[currentPageIndex], title: t };
      setPages(updated);
      const html = contentEditableRef.current?.innerHTML ?? "";
      updated[currentPageIndex] = { ...updated[currentPageIndex], content: html };
      savePagesToServer(updated);
    } else {
      saveDoc(t, undefined);
    }
  };

  const handleRenameClick = () => {
    setMoreMenuOpen(false);
    setTimeout(() => {
      if (settingsTab === "entireDoc") {
        docTitleInputRef.current?.focus();
        docTitleInputRef.current?.select();
      } else {
        setEditingPageIndex(currentPageIndex);
      }
    }, 0);
  };

  const handlePageTitleInSidebarBlur = (index: number) => {
    const updated = [...pages];
    const t = (updated[index].title || "").trim() || "Untitled";
    updated[index] = { ...updated[index], title: t };
    setPages(updated);
    if (index === currentPageIndex) setLocalTitle(t);
    setEditingPageIndex(null);
    savePagesToServer(updated);
  };

  useEffect(() => {
    if (editingPageIndex === null) return;
    const t = setTimeout(() => {
      pageRenameInSidebarRef.current?.focus();
      pageRenameInSidebarRef.current?.select();
    }, 0);
    return () => clearTimeout(t);
  }, [editingPageIndex]);

  const handleCopyLink = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setMoreMenuOpen(false);
      setShowCopyToast(true);
    }).catch(() => setMoreMenuOpen(false));
  };

  useEffect(() => {
    if (!showCopyToast) return;
    const t = setTimeout(() => setShowCopyToast(false), 2500);
    return () => clearTimeout(t);
  }, [showCopyToast]);

  const handleContentBlur = () => debouncedSaveContent();

  // Reset "loaded" flag when docId changes so we load new doc content when it arrives
  useEffect(() => {
    lastLoadedDocIdRef.current = null;
  }, [docId]);

  // Parse doc content into pages and sync to editor when doc is first loaded for this docId
  useEffect(() => {
    if (!doc || doc.id !== docId || !contentEditableRef.current) return;
    if (lastLoadedDocIdRef.current === docId) return;
    lastLoadedDocIdRef.current = docId;
    let initialPages: Array<{ title: string; content: string }>;
    try {
      const c = (doc.content ?? "").trim();
      if (c.startsWith("{")) {
        const parsed = JSON.parse(c) as { pages?: Array<{ title: string; content: string }> };
        if (Array.isArray(parsed.pages) && parsed.pages.length > 0) {
          initialPages = parsed.pages;
        } else {
          initialPages = [{ title: doc.title || "Untitled", content: doc.content ?? "" }];
        }
      } else {
        initialPages = [{ title: doc.title || "Untitled", content: doc.content ?? "" }];
      }
    } catch {
      initialPages = [{ title: doc.title || "Untitled", content: doc.content ?? "" }];
    }
    setPages(initialPages);
    setCurrentPageIndex(0);
    contentEditableRef.current.innerHTML = initialPages[0]?.content ?? "";
    setLocalTitle(initialPages[0]?.title ?? "Untitled");
  }, [docId, doc]);

  const applyFormat = useCallback(
    (command: "bold" | "italic" | "underline") => {
      const el = contentEditableRef.current;
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      if (!sel) return;
      if (savedSelectionRef.current) {
        sel.removeAllRanges();
        sel.addRange(savedSelectionRef.current);
      }
      document.execCommand(command, false);
      setFormatToolbarOpen(false);
      debouncedSaveContent();
    },
    [debouncedSaveContent]
  );

  const insertAtCursor = (htmlOrText: string) => {
    const el = contentEditableRef.current;
    if (!el) return;
    el.focus();
    document.execCommand("insertHTML", false, htmlOrText);
    debouncedSaveContent();
  };

  const switchToPage = useCallback(
    (index: number) => {
      if (index === currentPageIndex || index < 0 || index >= pages.length) return;
      // Cancel any pending debounced save so it doesn't run with stale page index
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      // Read current page content from DOM before any state update
      const html = contentEditableRef.current?.innerHTML ?? "";
      const updated = [...pages];
      updated[currentPageIndex] = { ...updated[currentPageIndex], content: html };
      setPages(updated);
      setCurrentPageIndex(index);
      // Show target page content from updated array
      if (contentEditableRef.current) {
        contentEditableRef.current.innerHTML = updated[index]?.content ?? "";
      }
      setLocalTitle(updated[index]?.title ?? "Untitled");
      savePagesToServer(updated);
    },
    [pages, currentPageIndex, savePagesToServer]
  );

  const addPage = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (pages.length === 0) {
      const first = [{ title: "Untitled", content: "" }];
      setPages(first);
      setCurrentPageIndex(0);
      if (contentEditableRef.current) contentEditableRef.current.innerHTML = "";
      setLocalTitle("Untitled");
      contentEditableRef.current?.focus();
      savePagesToServer(first);
      return;
    }
    const html = contentEditableRef.current?.innerHTML ?? "";
    const updated = [...pages];
    updated[currentPageIndex] = { ...updated[currentPageIndex], content: html };
    const newPage = { title: "Untitled", content: "" };
    updated.push(newPage);
    setPages(updated);
    setCurrentPageIndex(updated.length - 1);
    if (contentEditableRef.current) {
      contentEditableRef.current.innerHTML = "";
    }
    setLocalTitle("Untitled");
    contentEditableRef.current?.focus();
    savePagesToServer(updated);
  }, [pages, currentPageIndex, savePagesToServer]);

  const handleRefresh = () => {
    setLoading(true);
    loadDoc();
  };

  const handleDownload = () => {
    const title = localTitle.trim() || "Untitled";
    const textContent = contentEditableRef.current?.innerText ?? "";
    const blob = new Blob([title + "\n\n" + textContent], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = title.replace(/[^\w\s-]/g, "") + ".txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleDuplicate = async () => {
    setMoreMenuOpen(false);
    const content =
      pages.length > 0
        ? JSON.stringify({ pages: (() => {
            const updated = [...pages];
            updated[currentPageIndex] = { ...updated[currentPageIndex], content: getEditorContent() };
            return updated;
          })() })
        : doc?.content ?? "";
    try {
      const res = await fetch(`/api/projects/${projectId}/docs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ title: (localTitle || "Untitled") + " (copy)", content }),
      });
      if (res.ok) {
        const newDoc = await res.json();
        onDocDuplicated?.(newDoc.id, newDoc.title || "Untitled");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    setMoreMenuOpen(false);
    if (!confirm("Delete this doc? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/docs/${docId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        onDocDeleted?.(docId);
        onClose();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const addComment = () => {
    const t = newComment.trim();
    if (!t) return;
    setComments((prev) => [...prev, { id: crypto.randomUUID(), text: t, at: new Date().toISOString() }]);
    setNewComment("");
  };

  const authorName = doc?.author_name || doc?.author_email || currentUser?.name || currentUser?.email || "Unknown";
  const lastUpdated = doc?.updated_at
    ? (() => {
        const d = new Date(doc.updated_at);
        const now = new Date();
        if (d.toDateString() === now.toDateString()) return `Today at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
        return d.toLocaleDateString();
      })()
    : "";

  if (loading) {
    return embedded ? (
      <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-slate-200 min-h-[400px]">
        <p className="text-slate-500">Loading doc…</p>
      </div>
    ) : (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <p className="text-slate-500">Loading doc…</p>
        </div>
      </div>
    );
  }

  if (!doc) {
    return embedded ? (
      <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 min-h-[400px] p-8">
        <p className="text-slate-600 mb-4">Doc not found.</p>
        <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 rounded-lg hover:bg-slate-300">
          Close
        </button>
      </div>
    ) : (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 text-center">
          <p className="text-slate-600 mb-4">Doc not found.</p>
          <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 rounded-lg hover:bg-slate-300">
            Close
          </button>
        </div>
      </div>
    );
  }

  const wrapperClass = embedded
    ? "flex flex-col flex-1 min-h-0 bg-white rounded-xl border border-slate-200 overflow-y-auto flex flex-col"
    : "bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col";
  const outerProps = embedded
    ? { className: "flex flex-col flex-1 min-h-0" }
    : { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4", onClick: onClose };

  return (
    <div {...outerProps}>
      <div className={wrapperClass} onClick={(e: React.MouseEvent) => !embedded && e.stopPropagation()}>
        {/* Header: one row Docs / name + star + chevron (like second ss) */}
        <div className="flex items-center justify-between gap-2 p-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-slate-500 text-sm shrink-0">Docs /</span>
            <span className="text-slate-500 shrink-0">📄</span>
            <input
              ref={docTitleInputRef}
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              onBlur={handleDocTitleBlur}
              className="flex-1 min-w-0 text-slate-800 font-medium bg-transparent border-none outline-none focus:ring-0 p-0 truncate selection:bg-blue-200"
              placeholder="Doc name"
            />
            <button
              type="button"
              onClick={() => isFav && removeFavorite("doc", docId)}
              className={`shrink-0 p-1 rounded ${isFav ? "text-amber-500" : "text-slate-300"}`}
              title={isFav ? "Unfavorite (click to remove from Favorites)" : "Favorite (add via Settings ⋯)"}
            >
              {isFav ? "★" : "☆"}
            </button>
          </div>
          <div className="flex items-center gap-1 relative shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreMenuOpen((o) => !o)}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100"
                title="More"
              >
                ⋯
              </button>
              {moreMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMoreMenuOpen(false)} aria-hidden />
                  <div className="absolute right-0 top-full mt-1 z-50 w-64 py-2 bg-white border border-slate-200 rounded-lg shadow-lg max-h-[80vh] overflow-y-auto">
                    <p className="px-3 py-1.5 text-sm font-semibold text-slate-800">Settings</p>
                    <div className="flex gap-0 border-b border-slate-200 mb-1">
                      <button type="button" onClick={() => setSettingsTab("entireDoc")} className={`px-3 py-2 text-xs font-medium border-b-2 ${settingsTab === "entireDoc" ? "text-slate-800 border-slate-800" : "text-slate-500 border-transparent"}`}>Entire Doc</button>
                      <button type="button" onClick={() => setSettingsTab("thisPage")} className={`px-3 py-2 text-xs font-medium border-b-2 ${settingsTab === "thisPage" ? "text-slate-800 border-slate-800" : "text-slate-500 border-transparent"}`}>This page</button>
                    </div>
                    <button type="button" onClick={handleRenameClick} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left">
                      <span className="text-slate-400">✏️</span> Rename
                    </button>
                    <button type="button" onClick={handleCopyLink} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left">
                      <span className="text-slate-400">🔗</span> Copy link
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (isFav) removeFavorite("doc", docId);
                        else addFavorite({ type: "doc", id: docId, name: docTitle || "Untitled", projectId });
                        setMoreMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left"
                    >
                      <span className="flex items-center gap-2"><span className="text-slate-400">⭐</span> {isFav ? "Unfavorite" : "Favorite"}</span>
                      <span className="text-slate-400">›</span>
                    </button>
                    <button type="button" onClick={() => { handleDuplicate(); setMoreMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left">
                      <span className="text-slate-400">📋</span> Duplicate
                    </button>
                    <button type="button" onClick={() => setMoreMenuOpen(false)} className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left">
                      <span className="flex items-center gap-2"><span className="text-slate-400">📁</span> Move to</span>
                      <span className="text-slate-400">›</span>
                    </button>
                    <button type="button" onClick={() => setMoreMenuOpen(false)} className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left">
                      <span className="flex items-center gap-2"><span className="text-slate-400">📥</span> Import</span>
                      <span className="text-slate-400">›</span>
                    </button>
                    <button type="button" onClick={() => { handleDownload(); setMoreMenuOpen(false); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left">
                      <span className="flex items-center gap-2"><span className="text-slate-400">📤</span> Export</span>
                      <span className="text-slate-400">›</span>
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    <button type="button" onClick={() => setMoreMenuOpen(false)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left">
                      <span className="text-slate-400">📦</span> Archive
                    </button>
                    <button type="button" onClick={() => { handleDelete(); setMoreMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left">
                      <span className="text-slate-400">🗑</span> Delete
                    </button>
                    <div className="border-t border-slate-100 mt-2 pt-2 px-2">
                      <button type="button" onClick={() => setMoreMenuOpen(false)} className="w-full py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 flex items-center justify-center gap-2">
                        <span className="text-slate-400">🔗</span> Sharing and Permissions
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 font-medium">
              ×
            </button>
          </div>
        </div>

        {showCopyToast && (
          <div className="fixed bottom-6 right-6 z-[60] px-3 py-2 rounded-lg bg-slate-800 text-white text-sm shadow-lg">
            Copied to clipboard
          </div>
        )}

        {/* Editor body - fills remaining height */}
        <div className="flex gap-4 p-6 flex-1 min-h-0 overflow-hidden">
          <div className="w-48 shrink-0 flex flex-col border-r border-slate-200 pr-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pages</p>
            <ul className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
              {pages.map((p, i) => (
                <li key={i}>
                  {editingPageIndex === i ? (
                    <input
                      ref={pageRenameInSidebarRef}
                      type="text"
                      value={p.title || ""}
                      onChange={(e) => {
                        const updated = [...pages];
                        updated[i] = { ...updated[i], title: e.target.value };
                        setPages(updated);
                        if (i === currentPageIndex) setLocalTitle(e.target.value);
                      }}
                      onBlur={() => handlePageTitleInSidebarBlur(i)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      className="w-full px-2 py-2 rounded-lg text-sm text-slate-800 border border-violet-300 focus:ring-1 focus:ring-violet-500 outline-none selection:bg-blue-200"
                      placeholder="Untitled"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => switchToPage(i)}
                      className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-sm truncate ${
                        i === currentPageIndex ? "bg-slate-100 text-slate-800 font-medium" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-slate-400 shrink-0">📄</span>
                      <span className="truncate">{p.title || "Untitled"}</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={addPage}
              className="mt-2 flex items-center gap-2 px-2 py-2 rounded-lg text-slate-600 hover:bg-slate-100 text-sm font-medium"
            >
              <span className="text-slate-400">+</span>
              <span>Add page</span>
            </button>
          </div>

          <div className="flex-1 min-w-0 min-h-0 flex flex-col relative">
            <h1 className="w-full text-3xl font-semibold text-slate-800 mb-1">{docTitle || "Untitled"}</h1>
            <p className="text-sm text-slate-500 mb-4 shrink-0">
              {authorName} • Last updated {lastUpdated}
              {saving && <span className="ml-2 text-violet-500">Saving…</span>}
            </p>
            <div className="relative flex-1 min-h-0 flex flex-col">
              <div
                ref={contentEditableRef}
                contentEditable
                suppressContentEditableWarning
                onBlur={handleContentBlur}
                onInput={() => debouncedSaveContent()}
                data-placeholder="Write or type '/' for commands and AI actions"
                className="flex-1 min-h-0 w-full p-0 border-none bg-transparent outline-none text-slate-700 focus:ring-0 block overflow-y-auto empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400"
                style={{ minHeight: "120px" }}
              />
            </div>
          </div>

          <div className="w-10 shrink-0 flex flex-col items-center gap-2 py-2 border-l border-slate-100">
            <button
              type="button"
              onClick={() => setCommentsOpen((o) => !o)}
              className={`p-2 rounded-lg text-slate-400 hover:bg-slate-100 ${commentsOpen ? "bg-slate-100" : ""}`}
              title="Comments"
            >
              💬
            </button>
            <div
              className="relative"
              onMouseEnter={() => {
                if (formatToolbarTimeoutRef.current) {
                  clearTimeout(formatToolbarTimeoutRef.current);
                  formatToolbarTimeoutRef.current = null;
                }
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
                setFormatToolbarOpen(true);
              }}
              onMouseLeave={() => {
                formatToolbarTimeoutRef.current = setTimeout(() => setFormatToolbarOpen(false), 250);
              }}
            >
              {formatToolbarOpen && (
                <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 z-50 flex gap-0.5 p-1.5 bg-white border border-slate-200 rounded-lg shadow-lg">
                  <button type="button" onClick={() => applyFormat("bold")} className="px-2.5 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-100 rounded border border-transparent hover:border-slate-200" title="Bold">B</button>
                  <button type="button" onClick={() => applyFormat("italic")} className="px-2.5 py-1.5 text-sm italic text-slate-700 hover:bg-slate-100 rounded border border-transparent hover:border-slate-200" title="Italic">I</button>
                  <button type="button" onClick={() => applyFormat("underline")} className="px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded border border-transparent hover:border-slate-200 underline" title="Underline">U</button>
                </div>
              )}
              <button
                type="button"
                className={`p-2 rounded-lg text-slate-400 hover:bg-slate-100 ${formatToolbarOpen ? "bg-slate-100" : ""}`}
                title="Format (Bold, Italic, Underline) – select text then hover here"
              >
                Aa
              </button>
            </div>
            <button type="button" onClick={handleRefresh} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100" title="Refresh">
              ↻
            </button>
            <button type="button" onClick={handleDownload} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100" title="Download">
              ↓
            </button>
          </div>

          {commentsOpen && (
            <div className="w-64 shrink-0 border-l border-slate-200 pl-4 flex flex-col">
              <p className="text-sm font-medium text-slate-700 mb-2">Comments</p>
              <ul className="flex-1 overflow-y-auto space-y-2 mb-3">
                {comments.length === 0 && <li className="text-sm text-slate-400">No comments yet.</li>}
                {comments.map((c) => (
                  <li key={c.id} className="text-sm text-slate-600 bg-slate-50 rounded p-2">
                    {c.text}
                    <span className="block text-xs text-slate-400 mt-1">{new Date(c.at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addComment()}
                  placeholder="Add a comment…"
                  className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded"
                />
                <button type="button" onClick={addComment} className="px-2 py-1.5 text-sm bg-slate-800 text-white rounded hover:bg-slate-700">
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Overview View Component - ClickUp-style cards
function OverviewView({
  projectId,
  project,
  stats,
  sections,
  tasks,
  members,
  onRefresh,
  onAddDoc,
  onOpenDoc,
  onUpdateProject,
  projectDocs = [],
}: {
  projectId: number;
  project: Project;
  projectDocs?: Array<{ id: number; title: string }>;
  stats: any;
  sections: Section[];
  tasks: Task[];
  members: ProjectMember[];
  onRefresh: () => Promise<void>;
  onAddDoc?: (docId: number, title?: string) => void;
  onOpenDoc?: (docId: number) => void;
  onUpdateProject?: (updates: Partial<Project>) => Promise<void>;
}) {
  const [overviewBannerDismissed, setOverviewBannerDismissed] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(() => new Date());
  const [autoRefreshOn, setAutoRefreshOn] = useState(true);
  const [projectFiles, setProjectFiles] = useState<Array<{ id: number; file_name: string; file_url: string; created_at: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [listColorOpen, setListColorOpen] = useState(false);
  const [listColorAnchor, setListColorAnchor] = useState<{ top: number; left: number } | null>(null);
  const settings = (project?.settings || {}) as Record<string, unknown>;
  const [listColor, setListColor] = useState<string>(() => (typeof settings.listColor === "string" ? settings.listColor : ""));
  // 3 colors – red, orange, green
  const LIST_COLORS = ["#EF4444", "#F59E0B", "#22C55E"] as const;

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/files`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setProjectFiles(data);
      }
    } catch {
      // ignore
    }
  }, [projectId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    const s = (project?.settings || {}) as Record<string, unknown>;
    if (typeof s.listColor === "string") setListColor(s.listColor);
  }, [project?.settings]);

  useEffect(() => {
    if (!listColorOpen) return;
    const onScroll = () => setListColorOpen(false);
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, [listColorOpen]);

  const handleRefresh = useCallback(async () => {
    await onRefresh();
    setLastRefreshed(new Date());
    loadFiles();
  }, [onRefresh, loadFiles]);

  const formatRefreshed = () => {
    const sec = Math.floor((Date.now() - lastRefreshed.getTime()) / 1000);
    if (sec < 60) return "Just now";
    const min = Math.floor(sec / 60);
    if (min === 1) return "1 min ago";
    return `${min} min ago`;
  };

  const handleFileSelect = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length || uploading) return;
      setUploading(true);
      try {
        for (let i = 0; i < fileList.length; i++) {
          const formData = new FormData();
          formData.append("file", fileList[i]);
          const res = await fetch(`/api/projects/${projectId}/files`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: formData,
          });
          if (res.ok) await loadFiles();
        }
      } finally {
        setUploading(false);
      }
    },
    [projectId, uploading, loadFiles]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);
  const onDragLeave = useCallback(() => setDragOver(false), []);

  const progressPct = stats?.progress_percentage ?? 0;
  const recentItems = tasks.slice(0, 5).map((t) => ({
    type: "List" as const,
    label: t.title,
    sub: sections.find((s) => s.id === t.section_id)?.name ?? "Task",
  }));
  if (recentItems.length === 0) recentItems.push({ type: "List" as const, label: project.name, sub: "in this space" });

  return (
    <div className="space-y-4">
      {/* Top bar */}
      {!overviewBannerDismissed && (
        <div className="flex items-center justify-between gap-4 py-2 px-4 bg-slate-100 rounded-lg border border-slate-200">
          <p className="text-sm text-slate-600">
            Get the most out of your Overview! Add, reorder, and resize cards to customize this page{" "}
            <button type="button" className="text-violet-600 font-medium hover:underline">
              Get Started
            </button>
          </p>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-slate-500">Refreshed: {formatRefreshed()}</span>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <span>Auto refresh:</span>
              <button
                type="button"
                role="switch"
                aria-checked={autoRefreshOn}
                onClick={() => setAutoRefreshOn((v) => !v)}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors ${autoRefreshOn ? "bg-violet-600 border-violet-600" : "bg-slate-200 border-slate-300"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${autoRefreshOn ? "translate-x-4" : "translate-x-0.5"}`}
                  style={{ marginTop: 2 }}
                />
              </button>
              <span className="capitalize">{autoRefreshOn ? "On" : "Off"}</span>
            </label>
            <button
              type="button"
              onClick={() => handleRefresh()}
              className="text-sm text-slate-600 hover:text-slate-800"
            >
              Customize
            </button>
            <button type="button" className="text-sm text-slate-600 hover:text-slate-800">
              Add card
            </button>
            <button
              type="button"
              onClick={() => setOverviewBannerDismissed(true)}
              className="p-1 text-slate-400 hover:text-slate-600"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Recent */}
        <Card className="min-h-[140px]">
          <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
            Recent
            <span className="text-slate-400 cursor-pointer" title="Filters">⚙</span>
          </h3>
          <div className="space-y-1">
            {recentItems.slice(0, 3).map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="text-slate-400">≡</span>
                <span>{item.label}</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500">{item.sub}</span>
              </div>
            ))}
            {recentItems.length === 0 && <p className="text-sm text-slate-500">No recent items</p>}
          </div>
        </Card>

        {/* Docs: empty = Add a Doc button; with docs = header + list (image style) */}
        <Card className="min-h-[140px]">
          {projectDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center min-h-[120px]">
              <div className="w-12 h-14 rounded border-2 border-slate-300 flex items-center justify-center text-slate-400 mb-2">
                <span className="text-2xl">📄</span>
              </div>
              <p className="text-sm text-slate-600 mb-3">There are no Docs in this location yet.</p>
              <button
                type="button"
                onClick={async () => {
                  if (!onAddDoc) return;
                  try {
                    const res = await fetch(`/api/projects/${projectId}/docs`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                      body: JSON.stringify({ title: "Untitled" }),
                    });
                    if (res.ok) {
                      const doc = await res.json();
                      onAddDoc(doc.id, doc.title || "Untitled");
                    }
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="px-3 py-1.5 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800"
              >
                Add a Doc
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 cursor-move select-none text-lg" title="Reorder">⋮⋮</span>
                  <h3 className="text-sm font-semibold text-slate-800">Docs</h3>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" className="p-1.5 rounded text-slate-400 hover:bg-slate-100" title="Expand">⤢</button>
                  <button
                    type="button"
                    className="p-1.5 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title="Add a Doc"
                    onClick={async () => {
                      if (!onAddDoc) return;
                      try {
                        const res = await fetch(`/api/projects/${projectId}/docs`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                          body: JSON.stringify({ title: "Untitled" }),
                        });
                        if (res.ok) {
                          const doc = await res.json();
                          onAddDoc(doc.id, doc.title || "Untitled");
                        }
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                  >
                    +
                  </button>
                  <button type="button" className="p-1.5 rounded text-slate-400 hover:bg-slate-100">⋯</button>
                </div>
              </div>
              <ul className="space-y-1">
                {projectDocs.map((d) => (
                  <li key={d.id} className="group">
                    <div className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-50 text-sm">
                      <button
                        type="button"
                        onClick={() => onOpenDoc?.(d.id)}
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                      >
                        <span className="text-slate-400 shrink-0">📄</span>
                        <span className="text-slate-800 font-medium truncate">{d.title}</span>
                        <span className="text-slate-400 shrink-0">•</span>
                        <span className="text-slate-500 truncate">in {project.name}</span>
                      </button>
                      <a
                        href={`/dashboard/projects/${projectId}?view=doc&docId=${d.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 p-1.5 rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Open in new tab"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        {/* Bookmarks */}
        <Card className="min-h-[140px] flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full border-2 border-slate-300 flex items-center justify-center text-slate-400 mb-2 text-xl">
            🔖
          </div>
          <p className="text-sm text-slate-600 mb-3 px-2">
            Bookmarks make it easy to save items or any URL from around the web.
          </p>
          <button type="button" className="px-3 py-1.5 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800">
            Add Bookmark
          </button>
        </Card>

        {/* Lists - full width, upar; neeche Folders + Resources */}
        <Card className="md:col-span-2 lg:col-span-3 min-h-[300px] relative">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Lists</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-left">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Color</th>
                  <th className="pb-2 pr-4 font-medium">Progress</th>
                  <th className="pb-2 pr-4 font-medium">Start</th>
                  <th className="pb-2 pr-4 font-medium">End</th>
                  <th className="pb-2 pr-4 font-medium">Priority</th>
                  <th className="pb-2 font-medium">Owner</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-4 flex items-center gap-2">
                    <span className="text-slate-400">≡</span>
                    {project.name}
                  </td>
                  <td className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setListColorAnchor({ top: rect.bottom + 6, left: rect.left });
                        setListColorOpen((o) => !o);
                      }}
                      className="w-6 h-6 rounded border border-slate-200 shadow-sm hover:ring-2 hover:ring-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500 shrink-0 flex items-center justify-center"
                      style={listColor ? { backgroundColor: listColor } : undefined}
                      title="Set color"
                    >
                      {!listColor && <span className="w-3 border-t border-slate-400" aria-hidden />}
                      <span className="sr-only">Set color</span>
                    </button>
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${progressPct}%` }} />
                      </div>
                      <span className="text-slate-500">{stats?.completed_tasks ?? 0}/{stats?.total_tasks ?? 0}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-slate-400">📅</td>
                  <td className="py-2 pr-4 text-slate-400">📅</td>
                  <td className="py-2 pr-4 text-slate-400">🚩</td>
                  <td className="py-2 text-slate-400">👤</td>
                </tr>
                <tr className="text-slate-500 hover:bg-slate-50">
                  <td colSpan={7} className="py-2">
                    <span className="inline-flex items-center gap-1">+ New List</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* Folders - Lists ke neeche, Resources ke sath */}
        <Card className="min-h-[140px] flex flex-col items-center justify-center text-center">
          <h3 className="text-sm font-semibold text-slate-800 mb-2 w-full flex items-center justify-between">
            <span>Folders</span>
            <span className="text-slate-400 cursor-pointer">⋮</span>
          </h3>
          <div className="w-14 h-12 rounded border-2 border-slate-300 flex items-center justify-center text-slate-400 mb-2 text-2xl">
            📁
          </div>
          <p className="text-sm text-slate-600 mb-3">Add new Folder to your Space</p>
          <button type="button" className="px-3 py-1.5 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800">
            Add Folder
          </button>
        </Card>

        {/* Resources - file upload; Folders ke sath same row */}
        <Card className="min-h-[160px] flex flex-col lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Resources</h3>
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`flex-1 min-h-[100px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
              dragOver ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            } ${uploading ? "opacity-60 pointer-events-none" : ""}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFileSelect(e.target.files);
                e.target.value = "";
              }}
            />
            <span className="text-3xl text-slate-400 mb-1">☁️↑</span>
            <p className="text-sm text-slate-600">
              Drop files here or <span className="text-violet-600 underline">attach</span>
            </p>
            {uploading && <p className="text-xs text-slate-500 mt-1">Uploading…</p>}
          </div>
          {projectFiles.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {projectFiles.slice(0, 3).map((f) => (
                <li key={f.id} className="flex items-center gap-2 truncate">
                  <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline truncate">
                    {f.file_name}
                  </a>
                </li>
              ))}
              {projectFiles.length > 3 && (
                <li className="text-slate-500">+{projectFiles.length - 3} more</li>
              )}
            </ul>
          )}
        </Card>

      </div>

      {/* Set list color – body mein portal; position fixed viewport se, scroll se nahi hilna */}
      {listColorOpen && listColorAnchor && typeof document !== "undefined" && createPortal(
        <div
          className="z-[9999] w-48 bg-white rounded-xl shadow-xl border border-slate-200 p-3"
          style={{
            position: "fixed",
            top: listColorAnchor.top,
            left: listColorAnchor.left,
            transform: "translateZ(0)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">Set list color</span>
            <button type="button" onClick={() => setListColorOpen(false)} className="text-slate-400 hover:text-slate-600 leading-none" aria-label="Close">✕</button>
          </div>
          <div className="flex gap-2">
            {LIST_COLORS.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => {
                  setListColor(hex);
                  setListColorOpen(false);
                  const next = { ...(project?.settings || {}), listColor: hex } as Record<string, unknown>;
                  onUpdateProject?.({ settings: next });
                }}
                className={`flex-1 h-10 rounded-lg border-2 transition-all focus:outline-none focus:ring-2 focus:ring-violet-500 ${listColor === hex ? "border-slate-800 ring-1 ring-slate-300" : "border-slate-200 hover:border-slate-300"}`}
                style={{ backgroundColor: hex }}
                title={hex === "#EF4444" ? "Red" : hex === "#F59E0B" ? "Orange" : "Green"}
              >
                {listColor === hex && <span className="text-white font-bold drop-shadow-md text-sm">✓</span>}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Board View Component (Kanban) – design like reference: dynamic card height, "+ Add task" at bottom of each column
function BoardView({
  sections,
  tasks,
  members,
  getTasksBySection,
  getPriorityColor,
  getAssigneeName,
  isOverdue,
  onTaskClick,
  onUpdateTask,
  onAddTaskInSection,
}: {
  sections: Section[];
  tasks: Task[];
  members: ProjectMember[];
  getTasksBySection: (id: number) => Task[];
  getPriorityColor: (p: TaskPriority) => string;
  getAssigneeName: (id: number | null) => string | null;
  isOverdue: (date: string | null) => boolean;
  onTaskClick: (task: Task) => void;
  onUpdateTask: (id: number, updates: Partial<Task>) => Promise<void>;
  onAddTaskInSection: (sectionId: number) => void;
}) {
  function getUserInitials(userId: number | null): string {
    if (!userId) return "?";
    const member = members.find((m) => m.user_id === userId);
    if (!member?.user) return "?";
    const name = member.user.name || member.user.email || "";
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase() || "?";
  }

  function formatDateRange(due: string | null, start: string | null): string {
    if (!due && !start) return "";
    const d = due ? new Date(due) : start ? new Date(start) : null;
    const s = start ? new Date(start) : d;
    if (!d || isNaN(d.getTime())) return "";
    if (!s || isNaN(s.getTime()) || s.getTime() === d.getTime()) {
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    }
    return `${s.getDate()} – ${d.getDate()} ${d.toLocaleDateString("en-GB", { month: "short" })}`;
  }

  const priorityLabel = (p: TaskPriority) => (p === "medium" ? "Normal" : p === "high" ? "High" : "Low");

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
      {sections.map((section) => {
        const sectionTasks = getTasksBySection(section.id);
        return (
          <div
            key={section.id}
            className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/80 overflow-hidden w-full"
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white/60 shrink-0">
              <h3 className="text-sm font-semibold text-slate-800">{section.name}</h3>
              <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded">
                {sectionTasks.length}
              </span>
            </div>
            {/* Task list – height = content (jitne tasks utna), max scroll when zyada */}
            <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
              {sectionTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:shadow-md hover:border-slate-300 transition-all text-left"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-slate-400 mt-0.5 shrink-0" aria-hidden>
                      ✓
                    </span>
                    <h4 className="font-medium text-slate-800 text-sm flex-1 break-words">{task.title}</h4>
                  </div>
                  {(task.priority || task.assignee_id || task.due_date || task.start_date) && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {task.priority && (
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}
                        >
                          {priorityLabel(task.priority)}
                        </span>
                      )}
                      {task.assignee_id ? (
                        <span
                          className="w-6 h-6 rounded-full bg-violet-500 text-white text-[10px] flex items-center justify-center font-medium shrink-0"
                          title={getAssigneeName(task.assignee_id) ?? undefined}
                        >
                          {getUserInitials(task.assignee_id)}
                        </span>
                      ) : (
                        <span className="w-6 h-6 rounded-full border-2 border-dashed border-slate-300 shrink-0" aria-hidden />
                      )}
                      {(task.due_date || task.start_date) && (
                        <span
                          className={`text-xs ${isOverdue(task.due_date) ? "text-red-600 font-medium" : "text-slate-500"}`}
                        >
                          {formatDateRange(task.due_date, task.start_date)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* + Add task – always at bottom of column */}
            <div className="p-3 border-t border-slate-200 bg-white/40 shrink-0">
              <button
                type="button"
                onClick={() => onAddTaskInSection(section.id)}
                className="w-full py-2.5 px-3 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-colors"
              >
                + Add task
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// List View Component - ClickUp Style
function ListView({
  tasks,
  sections,
  members,
  getPriorityColor,
  getAssigneeName,
  isOverdue,
  onTaskClick,
  onUpdateTask,
  onTaskMarkedComplete,
  onCreateTask,
  projectId,
  setToast,
  onDeleteTask,
  openAddTaskInSectionId,
  onOpenAddTaskHandled,
}: {
  tasks: Task[];
  sections: Section[];
  members: ProjectMember[];
  getPriorityColor: (p: TaskPriority) => string;
  getAssigneeName: (id: number | null) => string | null;
  isOverdue: (date: string | null) => boolean;
  onTaskClick: (task: Task) => void;
  onUpdateTask: (id: number, updates: Partial<Task>) => Promise<void>;
  onTaskMarkedComplete?: (taskId: number, previousStatus: TaskStatus) => void;
  onCreateTask: (sectionId: number, title: string, options?: { assignee_id?: number | null; due_date?: string | null; priority?: TaskPriority }) => Promise<void>;
  projectId: number;
  setToast: (t: { message: string; error?: boolean } | null) => void;
  onDeleteTask: (taskId: number) => Promise<void>;
  openAddTaskInSectionId?: number | null;
  onOpenAddTaskHandled?: () => void;
}) {
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());
  const [newTaskTitles, setNewTaskTitles] = useState<Record<number, string>>({});
  const [newTaskMeta, setNewTaskMeta] = useState<Record<number, { assignee_id: number | null; due_date: string | null; priority: TaskPriority }>>({});
  const [rowMenuTaskId, setRowMenuTaskId] = useState<number | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  type PopoverType = "assignee" | "due" | "priority" | "status";
  const [activePopover, setActivePopover] = useState<{
    type: PopoverType;
    taskId: number | "new";
    sectionId?: number;
    left: number;
    top: number;
  } | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [dueCalendarView, setDueCalendarView] = useState({ month: new Date().getMonth(), year: new Date().getFullYear() });
  const [expandedAddSectionId, setExpandedAddSectionId] = useState<number | null>(null);
  const [shareTaskModal, setShareTaskModal] = useState<{ taskId: number; taskTitle: string } | null>(null);
  const [shareInviteEmail, setShareInviteEmail] = useState("");
  const [shareInvitePermission, setShareInvitePermission] = useState<"view" | "comment" | "edit" | "full_edit">("full_edit");
  const [shareInviteLoading, setShareInviteLoading] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [shareListExpanded, setShareListExpanded] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [taskFilter, setTaskFilter] = useState<"all" | "incomplete" | "complete">("all");
  // Only show dull when user ticked the checkbox in this session; already-completed (e.g. Done) tasks stay normal
  const [userMarkedCompleteInSession, setUserMarkedCompleteInSession] = useState<Set<number>>(new Set());
  // Status popover: one box – top tab "Status" | "Task Type", below show only that content
  const [statusPopoverTab, setStatusPopoverTab] = useState<"status" | "taskType">("status");

  useEffect(() => {
    if (activePopover?.type !== "due") return;
    const draft = getTaskOrDraft(activePopover.taskId, activePopover.sectionId);
    const d = draft?.due_date ? new Date(draft.due_date) : new Date();
    if (!isNaN(d.getTime())) setDueCalendarView({ month: d.getMonth(), year: d.getFullYear() });
  }, [activePopover?.type, activePopover?.taskId, activePopover?.sectionId]);

  useEffect(() => {
    if (activePopover?.type === "status" && activePopover?.taskId !== "new") setStatusPopoverTab("status");
  }, [activePopover?.type, activePopover?.taskId]);

  useEffect(() => {
    if (!shareTaskModal) setShareListExpanded(false);
  }, [shareTaskModal]);

  useEffect(() => {
    if (openAddTaskInSectionId != null) {
      setExpandedAddSectionId(openAddTaskInSectionId);
      onOpenAddTaskHandled?.();
    }
  }, [openAddTaskInSectionId, onOpenAddTaskHandled]);

  // Helper to get user initials
  function getUserInitials(userId: number | null): string {
    if (!userId) return "?";
    const member = members.find((m) => m.user_id === userId);
    if (!member?.user) return "?";
    const name = member.user.name || member.user.email;
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  // Helper to get user for avatar
  function getUser(userId: number | null) {
    if (!userId) return null;
    return members.find((m) => m.user_id === userId)?.user;
  }

  // Helper to format date as M/D/YY (e.g. 3/5/26)
  function formatDueDate(date: string | null): string {
    if (!date) return "-";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-";
    const M = d.getMonth() + 1;
    const D = d.getDate();
    const Y = d.getFullYear() % 100;
    return `${M}/${D}/${Y}`;
  }

  // Helper to get status color
  function getStatusColor(status: TaskStatus): string {
    switch (status) {
      case "on_track":
        return "bg-green-100 text-green-800 border-green-300";
      case "still_waiting":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "completed":
        return "bg-orange-100 text-orange-800 border-orange-300";
      default:
        return "bg-slate-100 text-slate-800 border-slate-300";
    }
  }

  // Helper to get priority tag/badge color: High=red, Normal=yellow, Low=green
  function getPriorityTagColor(priority: TaskPriority): string {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-slate-100 text-slate-800 border-slate-300";
    }
  }

  // Emoji for task type (shown next to task title). Default "task" = dotted circle.
  function getTaskTypeEmoji(taskType: TaskType): string {
    const map: Record<TaskType, string> = {
      task: "◌",
      milestone: "🎯",
      form_response: "📄",
      meeting_note: "📋",
      software_dev: "💻",
      dataset: "📊",
      video_processing: "🎬",
      sports_coaching: "⚽",
      research_docs: "📚",
    };
    return map[taskType] ?? "◌";
  }

  // Colored flag for priority: High=red, Normal=yellow, Low=green
  function getPriorityFlagBg(priority: TaskPriority): string {
    switch (priority) {
      case "high":
        return "bg-red-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-green-500";
      default:
        return "bg-slate-400";
    }
  }

  function toggleSection(sectionId: number) {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(sectionId)) {
      newCollapsed.delete(sectionId);
    } else {
      newCollapsed.add(sectionId);
    }
    setCollapsedSections(newCollapsed);
  }

  async function handleAddTask(sectionId: number) {
    const title = newTaskTitles[sectionId]?.trim();
    if (!title) return;
    const meta = newTaskMeta[sectionId];
    await onCreateTask(sectionId, title, meta ? { assignee_id: meta.assignee_id, due_date: meta.due_date, priority: meta.priority } : undefined);
    setNewTaskTitles({ ...newTaskTitles, [sectionId]: "" });
    setNewTaskMeta((prev) => ({ ...prev, [sectionId]: { assignee_id: null, due_date: null, priority: "medium" } }));
    setExpandedAddSectionId(null);
  }

  function openPopover(type: PopoverType, taskId: number | "new", sectionId: number | undefined, e: React.MouseEvent) {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setActivePopover({ type, taskId, sectionId, left: rect.left, top: rect.bottom + 4 });
    if (type === "assignee") setAssigneeSearch("");
  }

  function getTaskOrDraft(taskId: number | "new", sectionId?: number) {
    if (taskId === "new" && sectionId != null) {
      const meta = newTaskMeta[sectionId];
      return { assignee_id: meta?.assignee_id ?? null, due_date: meta?.due_date ?? null, priority: (meta?.priority ?? "medium") as TaskPriority };
    }
    const t = tasks.find((x) => x.id === taskId);
    return t ? { assignee_id: t.assignee_id, due_date: t.due_date, priority: t.priority } : null;
  }

  function setTaskOrDraft(taskId: number | "new", sectionId: number | undefined, updates: { assignee_id?: number | null; due_date?: string | null; priority?: TaskPriority }) {
    if (taskId === "new" && sectionId != null) {
      setNewTaskMeta((prev) => {
        const cur = prev[sectionId] ?? { assignee_id: null, due_date: null, priority: "medium" as TaskPriority };
        return { ...prev, [sectionId]: { ...cur, ...updates } };
      });
      return;
    }
    if (typeof taskId === "number") onUpdateTask(taskId, updates);
  }

  // Group tasks by section. Apply taskFilter. When "all", show all tasks in each section (completed stay in place, dull + green check).
  const tasksBySection = sections.reduce((acc, section) => {
    acc[section.id] = tasks.filter((t) => {
      if (t.section_id !== section.id) return false;
      if (taskFilter === "incomplete") return t.status !== "completed";
      if (taskFilter === "complete") return t.status === "completed";
      return true;
    });
    return acc;
  }, {} as Record<number, Task[]>);

  return (
    <div className="space-y-3">
      {/* Controls Bar - compact */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/30">
        <div className="flex items-center gap-1.5">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              const toDo = sections.find((s) => /^to\s*do$/i.test(s.name.trim())) ?? sections[0];
              if (toDo) setExpandedAddSectionId(toDo.id);
            }}
            className="text-xs py-1.5 px-2.5"
          >
            + Add task
          </Button>
        </div>
        <div className="flex items-center gap-1 relative">
          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterPanelOpen((v) => !v)}
              className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors shadow-sm ${taskFilter !== "all" ? "text-violet-700 bg-violet-100 border-violet-300 hover:bg-violet-200/80" : "text-slate-700 bg-white/80 border-slate-200 hover:bg-white hover:border-violet-200 hover:text-violet-700"}`}
            >
              Filter
            </button>
            {filterPanelOpen && (
              <>
                <div className="fixed inset-0 z-10" aria-hidden onClick={() => setFilterPanelOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-56 py-2 bg-white rounded-lg shadow-lg border border-slate-200">
                  <div className="flex items-center justify-between px-3 pb-2 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-700">Filters</span>
                    <button
                      type="button"
                      onClick={() => { setTaskFilter("all"); setFilterPanelOpen(false); }}
                      className="text-xs text-violet-600 hover:text-violet-700"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="px-2 pt-1.5 text-xs font-medium text-slate-500">Quick filters</div>
                  <button
                    type="button"
                    onClick={() => { setTaskFilter("incomplete"); setFilterPanelOpen(false); }}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 rounded-md ${taskFilter === "incomplete" ? "bg-violet-50 text-violet-800" : "text-slate-700 hover:bg-slate-50"}`}
                  >
                    {taskFilter === "incomplete" ? <span className="text-violet-600">✓</span> : <span className="w-4" />}
                    Incomplete tasks
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTaskFilter("complete"); setFilterPanelOpen(false); }}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 rounded-md ${taskFilter === "complete" ? "bg-violet-50 text-violet-800" : "text-slate-700 hover:bg-slate-50"}`}
                  >
                    {taskFilter === "complete" ? <span className="text-violet-600">✓</span> : <span className="w-4" />}
                    Completed tasks
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table Structure - compact table-like spacing */}
      <div className="bg-white/30 backdrop-blur-sm rounded-lg border border-white/50 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_2rem] gap-2 px-3 py-2 bg-white/50 border-b border-white/30 font-semibold text-xs text-slate-700">
          <div>Name</div>
          <div>Assignee</div>
          <div>Due date</div>
          <div>Priority</div>
          <div />
        </div>

        {/* Sections */}
        {sections.map((section) => {
          const sectionTasks = tasksBySection[section.id] || [];
          const isCollapsed = collapsedSections.has(section.id);

          return (
            <div key={section.id} className="border-b border-white/20 last:border-b-0">
              {/* Section Header */}
              <div
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 cursor-pointer transition-colors"
                onClick={() => toggleSection(section.id)}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs transition-transform ${isCollapsed ? "" : "rotate-90"}`}>
                    ▶
                  </span>
                  <span className="text-sm font-medium text-slate-700">{section.name}</span>
                  <span className="text-xs text-slate-500">({sectionTasks.length})</span>
                </div>
              </div>

              {/* Tasks in Section */}
              {!isCollapsed && (
                <div>
                  {sectionTasks.map((task) => {
                    const assignee = getUser(task.assignee_id);
                    const isTaskCompleted = task.status === "completed";
                    const showDull = isTaskCompleted && userMarkedCompleteInSession.has(task.id);
                    const isEditing = editingTaskId === task.id;
                    const isMenuOpen = rowMenuTaskId === task.id;

                    return (
                      <div
                        key={task.id}
                        onClick={() => !isEditing && onTaskClick(task)}
                        className={`group grid grid-cols-[2fr_1fr_1fr_1fr_2rem] gap-2 px-3 py-2 cursor-pointer transition-colors border-b border-white/10 last:border-b-0 items-center ${isEditing ? "bg-blue-100/80 hover:bg-blue-100/80" : "hover:bg-white/40"} ${showDull ? "opacity-80" : ""}`}
                      >
                        {/* Name Column - checkbox (hover) + emoji + title or inline edit */}
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isTaskCompleted) {
                                setUserMarkedCompleteInSession((prev) => {
                                  const next = new Set(prev);
                                  next.delete(task.id);
                                  return next;
                                });
                                onUpdateTask(task.id, { status: "on_track" });
                              } else {
                                setUserMarkedCompleteInSession((prev) => new Set(prev).add(task.id));
                                onUpdateTask(task.id, { status: "completed" });
                                onTaskMarkedComplete?.(task.id, task.status);
                              }
                            }}
                            className="shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1 opacity-0 group-hover:opacity-100 border-slate-300 hover:border-violet-400 hover:bg-violet-50"
                            title={isTaskCompleted ? "Mark incomplete" : "Mark complete"}
                          >
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPopover("status", task.id, section.id, e);
                            }}
                            className="text-sm shrink-0 cursor-pointer hover:opacity-80 focus:outline-none rounded p-0.5 flex items-center justify-center"
                            title="task type"
                          >
                            {task.task_type === "task" ? (
                              <span className="w-4 h-4 rounded-full border-2 border-dashed border-slate-400 inline-block" aria-hidden />
                            ) : (
                              getTaskTypeEmoji(task.task_type)
                            )}
                          </button>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === "Enter") {
                                  const t = editingTitle.trim();
                                  if (t) onUpdateTask(task.id, { title: t }).then(() => { setEditingTaskId(null); setEditingTitle(""); });
                                }
                                if (e.key === "Escape") {
                                  setEditingTaskId(null);
                                  setEditingTitle("");
                                }
                              }}
                              onBlur={() => {
                                const t = editingTitle.trim();
                                if (t && t !== task.title) onUpdateTask(task.id, { title: t });
                                setEditingTaskId(null);
                                setEditingTitle("");
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 min-w-0 px-2 py-1 text-xs bg-white border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-800"
                              autoFocus
                            />
                          ) : (
                            <span className={`text-xs truncate ${showDull ? "text-slate-400" : "text-slate-800"}`}>
                              {task.title}
                            </span>
                          )}
                        </div>

                        {/* Assignee Column */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openPopover("assignee", task.id, undefined, e); }}
                            className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-white/60 text-left min-w-0"
                          >
                            {assignee ? (
                              <>
                                <div className="w-5 h-5 rounded-full bg-violet-500 text-white text-[10px] flex items-center justify-center font-medium shrink-0">
                                  {getUserInitials(task.assignee_id)}
                                </div>
                                <span className="text-xs text-slate-600 truncate">
                                  {assignee.name || assignee.email.split("@")[0]}
                                </span>
                              </>
                            ) : (
                              <span className="text-slate-400 text-xs leading-none" title="Assignee">👤+</span>
                            )}
                          </button>
                        </div>

                        {/* Due Date Column */}
                        <div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openPopover("due", task.id, undefined, e); }}
                            className={`flex items-center gap-1 px-1 py-0.5 rounded hover:bg-white/60 text-xs ${isOverdue(task.due_date) && !isTaskCompleted ? "text-red-600 font-medium" : "text-slate-600"}`}
                          >
                            <span className="text-slate-400 text-sm leading-none">📅+</span>
                            {formatDueDate(task.due_date)}
                          </button>
                        </div>

                        {/* Priority Column + 3-dot menu (visible on row hover) */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openPopover("priority", task.id, undefined, e); }}
                            className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-white/60 text-left min-w-0"
                          >
                            {task.priority ? (
                              <span className={`inline-block w-3 h-3 rounded-sm shrink-0 ${getPriorityFlagBg(task.priority)}`} title={task.priority} />
                            ) : (
                              <span className="inline-block w-3 h-3 rounded-sm shrink-0 bg-slate-200" title="Priority" />
                            )}
                            {task.priority ? (
                              <span className={`px-1 py-0.5 rounded text-[10px] font-medium border shrink-0 ${getPriorityTagColor(task.priority)}`}>
                                {task.priority === "high" ? "High" : task.priority === "medium" ? "Normal" : "Low"}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Priority</span>
                            )}
                          </button>
                          <div className="relative ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRowMenuTaskId(isMenuOpen ? null : task.id);
                              }}
                              className="p-1 rounded hover:bg-white/70 text-slate-500 hover:text-slate-700"
                              aria-label="Task options"
                            >
                              <span className="text-base leading-none">⋯</span>
                            </button>
                            {isMenuOpen && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  aria-hidden
                                  onClick={(e) => { e.stopPropagation(); setRowMenuTaskId(null); }}
                                />
                                <div className="absolute right-0 top-full mt-0.5 z-20 min-w-[120px] py-1 bg-white rounded-lg shadow-lg border border-slate-200">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingTaskId(task.id);
                                      setEditingTitle(task.title);
                                      setRowMenuTaskId(null);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                                  >
                                    Rename
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteTask(task.id);
                                      setRowMenuTaskId(null);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add Task Row: compact table row - placeholder or inline input row */}
                  {expandedAddSectionId !== section.id && !newTaskTitles[section.id] ? (
                    <div
                      className="grid grid-cols-[2fr_1fr_1fr_1fr_2rem] gap-2 px-3 py-2 border-t border-white/20 items-center text-slate-400 hover:bg-white/30 cursor-pointer transition-colors"
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedAddSectionId(section.id)}
                      onKeyDown={(e) => e.key === "Enter" && setExpandedAddSectionId(section.id)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border border-dashed border-slate-400 shrink-0" aria-hidden />
                        <span className="text-xs">Add task...</span>
                      </div>
                      <div />
                      <div />
                      <div />
                      <div />
                    </div>
                  ) : (
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_2rem] gap-2 px-3 py-2 border-t border-white/20 items-center bg-white/20">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-4 h-4 rounded-full border border-dashed border-slate-400 shrink-0" aria-hidden />
                        <input
                          type="text"
                          placeholder="Task name..."
                          value={newTaskTitles[section.id] || ""}
                          onChange={(e) =>
                            setNewTaskTitles({ ...newTaskTitles, [section.id]: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddTask(section.id);
                            if (e.key === "Escape") {
                              setExpandedAddSectionId(null);
                              setNewTaskTitles({ ...newTaskTitles, [section.id]: "" });
                              setNewTaskMeta((p) => ({ ...p, [section.id]: { assignee_id: null, due_date: null, priority: "medium" } }));
                            }
                          }}
                          onBlur={() => {
                            if (!newTaskTitles[section.id]?.trim()) setExpandedAddSectionId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 min-w-0 px-2 py-1 text-xs bg-white/80 border border-white/60 rounded focus:outline-none focus:ring-1 focus:ring-violet-400 placeholder:text-slate-400"
                          autoFocus={expandedAddSectionId === section.id}
                        />
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={(e) => openPopover("assignee", "new", section.id, e)}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/60 text-slate-500 text-xs"
                          title="Assignee"
                        >
                          {newTaskMeta[section.id]?.assignee_id != null ? (
                            <>
                              <div className="w-5 h-5 rounded-full bg-violet-500 text-white text-[10px] flex items-center justify-center font-medium shrink-0">
                                {getUserInitials(newTaskMeta[section.id]!.assignee_id)}
                              </div>
                              <span className="truncate">{getAssigneeName(newTaskMeta[section.id]!.assignee_id) ?? "—"}</span>
                            </>
                          ) : (
                            <span className="text-slate-400" title="Assignee">👤+</span>
                          )}
                        </button>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={(e) => openPopover("due", "new", section.id, e)}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/60 text-slate-500 text-xs"
                          title="Due date"
                        >
                          <span className="text-slate-400">📅</span>
                          {newTaskMeta[section.id]?.due_date ? <span className="truncate">{formatDueDate(newTaskMeta[section.id]!.due_date)}</span> : <span>—</span>}
                        </button>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={(e) => openPopover("priority", "new", section.id, e)}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/60 text-slate-500 text-xs"
                          title="Priority"
                        >
                          {newTaskMeta[section.id]?.priority ? (
                            <span className={`inline-block w-3 h-3 rounded-sm shrink-0 ${getPriorityFlagBg(newTaskMeta[section.id]!.priority)}`} />
                          ) : (
                            <span className="inline-block w-3 h-3 rounded-sm shrink-0 bg-slate-200" />
                          )}
                          {newTaskMeta[section.id]?.priority
                            ? <span>{newTaskMeta[section.id]!.priority === "high" ? "High" : newTaskMeta[section.id]!.priority === "medium" ? "Normal" : "Low"}</span>
                            : <span className="text-slate-400">—</span>}
                        </button>
                      </div>
                      <div />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Assignee / Due date / Priority popovers */}
      {activePopover && (
        <>
          <div
            className="fixed inset-0 z-[100]"
            aria-hidden
            onClick={() => setActivePopover(null)}
          />
          <div
            className="fixed z-[101] bg-white border border-slate-200 rounded-lg shadow-xl min-w-[240px] max-w-[320px] overflow-hidden"
            style={{ left: activePopover.left, top: activePopover.top }}
          >
            {activePopover.type === "assignee" && (
              <div className="p-2">
                <input
                  type="text"
                  placeholder="Search or enter email..."
                  value={assigneeSearch}
                  onChange={(e) => setAssigneeSearch(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md mb-2 focus:ring-2 focus:ring-violet-500 outline-none"
                  autoFocus
                />
                <ul className="max-h-48 overflow-y-auto space-y-0.5">
                  {members
                    .filter(
                      (m) =>
                        !assigneeSearch.trim() ||
                        (m.user?.name?.toLowerCase().includes(assigneeSearch.toLowerCase()) ||
                          m.user?.email?.toLowerCase().includes(assigneeSearch.toLowerCase()))
                    )
                    .map((m) => {
                      const draft = getTaskOrDraft(activePopover.taskId, activePopover.sectionId);
                      const selected = draft?.assignee_id === m.user_id;
                      return (
                        <li key={m.user_id}>
                          <button
                            type="button"
                            onClick={() => {
                              setTaskOrDraft(activePopover.taskId, activePopover.sectionId, { assignee_id: m.user_id });
                              setActivePopover(null);
                            }}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-sm hover:bg-slate-50 ${selected ? "bg-violet-50 text-violet-800" : "text-slate-700"}`}
                          >
                            <div className="w-7 h-7 rounded-full bg-violet-500 text-white text-xs flex items-center justify-center font-medium shrink-0">
                              {getUserInitials(m.user_id)}
                            </div>
                            <span className="truncate">{m.user?.name || m.user?.email || "User"}</span>
                          </button>
                        </li>
                      );
                    })}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    setTaskOrDraft(activePopover.taskId, activePopover.sectionId, { assignee_id: null });
                    setActivePopover(null);
                  }}
                  className="w-full mt-1 px-2.5 py-2 text-sm text-slate-500 hover:bg-slate-50 rounded-md flex items-center gap-2"
                >
                  <span>✕</span> Unassigned
                </button>
                <div className="border-t border-slate-100 mt-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof activePopover.taskId === "number") {
                        const task = tasks.find((t) => t.id === activePopover.taskId);
                        setShareTaskModal({
                          taskId: activePopover.taskId,
                          taskTitle: task?.title ?? "Task",
                        });
                        setShareInviteEmail("");
                        setActivePopover(null);
                      }
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-md"
                  >
                    <span>+</span> Invite people via email
                  </button>
                </div>
              </div>
            )}

            {activePopover.type === "due" && (() => {
              const draft = getTaskOrDraft(activePopover.taskId, activePopover.sectionId);
              const { month: viewMonth, year: viewYear } = dueCalendarView;
              const years = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i);
              const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
              return (
                <div className="p-2 min-w-[260px]">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <select
                      value={viewMonth}
                      onChange={(e) => setDueCalendarView((v) => ({ ...v, month: Number(e.target.value) }))}
                      className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none"
                    >
                      {months.map((m, i) => (
                        <option key={m} value={i}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={viewYear}
                      onChange={(e) => setDueCalendarView((v) => ({ ...v, year: Number(e.target.value) }))}
                      className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none"
                    >
                      {years.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                    <div className="flex gap-0.5">
                      <button
                        type="button"
                        onClick={() => setDueCalendarView((v) => (v.month === 0 ? { month: 11, year: v.year - 1 } : { ...v, month: v.month - 1 }))}
                        className="p-1 rounded hover:bg-slate-100 text-slate-600"
                        aria-label="Previous month"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={() => setDueCalendarView((v) => (v.month === 11 ? { month: 0, year: v.year + 1 } : { ...v, month: v.month + 1 }))}
                        className="p-1 rounded hover:bg-slate-100 text-slate-600"
                        aria-label="Next month"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                      <div key={d} className="py-0.5 text-slate-500 font-medium">{d}</div>
                    ))}
                    {(() => {
                      const first = new Date(viewYear, viewMonth, 1).getDay();
                      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
                      const cells: React.ReactNode[] = [];
                      for (let i = 0; i < first; i++) cells.push(<div key={`e-${i}`} />);
                      for (let day = 1; day <= daysInMonth; day++) {
                        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const selected = draft?.due_date === dateStr;
                        cells.push(
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              setTaskOrDraft(activePopover.taskId, activePopover.sectionId, { due_date: dateStr });
                              setActivePopover(null);
                            }}
                            className={`py-1.5 rounded hover:bg-slate-100 ${selected ? "bg-violet-500 text-white hover:bg-violet-600" : "text-slate-700"}`}
                          >
                            {day}
                          </button>
                        );
                      }
                      return cells;
                    })()}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTaskOrDraft(activePopover.taskId, activePopover.sectionId, { due_date: null });
                      setActivePopover(null);
                    }}
                    className="w-full mt-2 px-2.5 py-1.5 text-sm text-slate-500 hover:bg-slate-50 rounded"
                  >
                    Clear
                  </button>
                </div>
              );
            })()}

            {activePopover.type === "priority" && (
              <div className="p-2">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Task Priority</div>
                {(
                  [
                    { value: "high" as TaskPriority, label: "High", flagBg: "bg-red-500", color: "text-red-600" },
                    { value: "medium" as TaskPriority, label: "Normal", flagBg: "bg-yellow-500", color: "text-yellow-700" },
                    { value: "low" as TaskPriority, label: "Low", flagBg: "bg-green-500", color: "text-green-600" },
                  ] as const
                ).map((p) => {
                  const draft = getTaskOrDraft(activePopover.taskId, activePopover.sectionId);
                  const selected = draft?.priority === p.value;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setTaskOrDraft(activePopover.taskId, activePopover.sectionId, { priority: p.value });
                        setActivePopover(null);
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-sm hover:bg-slate-50 ${selected ? "bg-violet-50" : ""}`}
                    >
                      <span className={`inline-block w-3.5 h-3.5 rounded-sm ${p.flagBg} shrink-0`} title={p.label} />
                      <span className={p.color}>{p.label}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setTaskOrDraft(activePopover.taskId, activePopover.sectionId, { priority: "medium" });
                    setActivePopover(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-sm text-slate-500 hover:bg-slate-50"
                >
                  <span className="inline-block w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" /> Clear
                </button>
              </div>
            )}

            {activePopover.type === "status" && activePopover.taskId !== "new" && (() => {
              const task = tasks.find((t) => t.id === activePopover.taskId);
              if (!task) return null;
              const toDoSection = sections.find((s) => /^to\s*do$/i.test(s.name.trim()));
              const doingSection = sections.find((s) => /^doing$/i.test(s.name.trim()));
              const doneSection = sections.find((s) => /^done$/i.test(s.name.trim()));
              const statusSections = [
                { label: "To Do", section: toDoSection },
                { label: "Doing", section: doingSection },
                { label: "Done", section: doneSection },
              ].filter((x) => x.section);
              const taskTypeOptions: { value: TaskType; label: string; emoji: string; default?: boolean }[] = [
                { value: "task", label: "Task", emoji: "◌", default: true },
                { value: "milestone", label: "Milestone", emoji: "🎯" },
                { value: "form_response", label: "Form Response", emoji: "📄" },
                { value: "meeting_note", label: "Meeting Note", emoji: "📋" },
              ];
              return (
                <div className="min-w-[240px] max-w-[280px] max-h-[70vh] flex flex-col overflow-hidden">
                  {/* Top: Status | Task Type – select one, content below changes */}
                  <div className="flex border-b border-slate-200 shrink-0">
                    <button
                      type="button"
                      onClick={() => setStatusPopoverTab("status")}
                      className={`flex-1 px-3 py-2 text-xs font-medium rounded-t ${statusPopoverTab === "status" ? "bg-slate-100 text-slate-800 border-b-2 border-violet-500 -mb-px" : "text-slate-500 hover:bg-slate-50"}`}
                    >
                      Status
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusPopoverTab("taskType")}
                      className={`flex-1 px-3 py-2 text-xs font-medium rounded-t ${statusPopoverTab === "taskType" ? "bg-slate-100 text-slate-800 border-b-2 border-violet-500 -mb-px" : "text-slate-500 hover:bg-slate-50"}`}
                    >
                      Task Type
                    </button>
                  </div>
                  {/* Content: only Status or only Task Type */}
                  {statusPopoverTab === "status" && statusSections.length > 0 && (
                    <div className="px-2 py-2 flex flex-col">
                      <div className="space-y-px">
                        {statusSections.map(({ label, section }) => {
                          const selected = task.section_id === section!.id;
                          const isDone = section!.id === doneSection?.id;
                          return (
                            <button
                              key={section!.id}
                              type="button"
                              onClick={() => {
                                onUpdateTask(task.id, {
                                  section_id: section!.id,
                                  status: isDone ? "completed" : "on_track",
                                });
                                setActivePopover(null);
                              }}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs hover:bg-slate-50 ${selected ? "bg-violet-50" : ""}`}
                            >
                              <span className="flex-1">{label}</span>
                              {selected && <span className="text-violet-500 text-xs">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {statusPopoverTab === "taskType" && (
                    <div className="px-2 py-2 flex flex-col min-h-0">
                      <div className="space-y-px overflow-y-auto min-h-0">
                        {taskTypeOptions.map((o) => {
                          const selected = task.task_type === o.value;
                          return (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() => {
                                onUpdateTask(task.id, { task_type: o.value });
                                setActivePopover(null);
                              }}
                              className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-left text-xs hover:bg-slate-50 ${selected ? "bg-violet-50" : ""}`}
                            >
                              <span className="shrink-0 flex items-center justify-center w-4 h-4">
                                {o.value === "task" ? (
                                  <span className="w-3 h-3 rounded-full border-2 border-dashed border-slate-400 inline-block" aria-hidden />
                                ) : (
                                  <span className="text-sm">{o.emoji}</span>
                                )}
                              </span>
                              <span className="flex-1 truncate">{o.label}{o.default ? " (default)" : ""}</span>
                              {selected && <span className="text-violet-500 text-xs shrink-0">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </>
      )}

      {/* Share this task modal - dims background */}
      {shareTaskModal && (
        <>
          <div
            className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm"
            aria-hidden
            onClick={() => setShareTaskModal(null)}
          />
          <div className="fixed inset-0 z-[111] flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 shrink-0">
                <h2 className="text-base font-semibold text-slate-800">Share this task</h2>
                <button
                  type="button"
                  onClick={() => setShareTaskModal(null)}
                  className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="px-4 py-3 space-y-2.5 overflow-y-auto min-h-0 flex-1">
                <p className="text-xs text-slate-600 flex items-center gap-1.5">
                  Sharing task <span className="w-3 h-3 rounded bg-slate-300 inline-block" /> {shareTaskModal.taskTitle}
                </p>
                <div className="flex gap-2 items-center">
                  <input
                    type="email"
                    placeholder="Invite by email"
                    value={shareInviteEmail}
                    onChange={(e) => setShareInviteEmail(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                  />
                  <select
                    value={shareInvitePermission}
                    onChange={(e) => setShareInvitePermission(e.target.value as "view" | "comment" | "edit" | "full_edit")}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-violet-500 outline-none shrink-0"
                    title="Permission for invitee"
                  >
                    <option value="view">View only</option>
                    <option value="comment">Comment</option>
                    <option value="edit">Edit</option>
                    <option value="full_edit">Full edit</option>
                  </select>
                  <button
                    type="button"
                    disabled={!shareInviteEmail.trim() || shareInviteLoading}
                    onClick={async () => {
                      const email = shareInviteEmail.trim();
                      if (!email || !projectId) return;
                      setShareInviteLoading(true);
                      try {
                        const res = await fetch(`/api/projects/${projectId}/invite`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                          body: JSON.stringify({
                            email,
                            permission: shareInvitePermission,
                            task_id: shareTaskModal?.taskId ?? null,
                          }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          setToast({ message: data.error || "Failed to send invitation", error: true });
                          return;
                        }
                        setToast({ message: data.message || "Invitation sent to " + email });
                        setShareInviteEmail("");
                      } finally {
                        setShareInviteLoading(false);
                      }
                    }}
                    className="px-3 py-1.5 text-sm font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 shrink-0"
                  >
                    {shareInviteLoading ? "Sending…" : "Invite"}
                  </button>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-slate-700 flex items-center gap-1.5">
                    <span className="text-slate-500">🔗</span> Private link <span className="text-slate-400 cursor-help" title="Copy link">ⓘ</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShareLinkCopied(true);
                      setTimeout(() => setShareLinkCopied(false), 2000);
                    }}
                    className="px-2 py-0.5 text-xs border border-slate-200 rounded hover:bg-slate-50 min-w-[72px]"
                  >
                    {shareLinkCopied ? "Copied" : "Copy link"}
                  </button>
                </div>
                <div className="pt-1.5 border-t border-slate-100">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Share with</p>
                  <button
                    type="button"
                    onClick={() => setShareListExpanded((v) => !v)}
                    className="w-full flex items-center justify-between py-1.5 rounded hover:bg-slate-50 text-left"
                  >
                    <span className="text-xs text-slate-700 flex items-center gap-1.5">
                      <span className={`text-slate-400 transition-transform ${shareListExpanded ? "rotate-90" : ""}`}>▶</span> List
                    </span>
                    <div className="flex items-center gap-1.5">
                      {members.slice(0, 2).map((m) => (
                        <span
                          key={m.user_id}
                          className="w-6 h-6 rounded-full bg-violet-500 text-white text-[10px] flex items-center justify-center font-medium"
                        >
                          {getUserInitials(m.user_id)}
                        </span>
                      ))}
                      <span className="relative w-9 h-5 rounded-full bg-violet-500 inline-block">
                        <span className="absolute top-0.5 left-4 w-4 h-4 rounded-full bg-white shadow" />
                      </span>
                    </div>
                  </button>
                  {shareListExpanded && (
                    <div className="pl-4 mt-1 space-y-1.5">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                        {members.length} People
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {members.map((m) => (
                          <div
                            key={m.user_id}
                            className="flex items-center justify-between gap-2 py-1.5 pr-1"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-6 h-6 rounded-full bg-violet-500 text-white text-[10px] flex items-center justify-center font-medium shrink-0">
                                {getUserInitials(m.user_id)}
                              </span>
                              <span className="text-xs text-slate-700 truncate">
                                {m.user?.email ?? "User"} {m.role === "owner" ? "Workspace Owner" : ""}
                              </span>
                            </div>
                            <select
                              className="text-[10px] border border-slate-200 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-violet-500 outline-none shrink-0"
                              value={m.role === "owner" ? "full_edit" : (m.permission ?? "full_edit")}
                              disabled={m.role === "owner"}
                              onChange={async (e) => {
                                if (m.role === "owner") return;
                                const perm = e.target.value as "view" | "comment" | "edit" | "full_edit";
                                try {
                                  const res = await fetch(`/api/projects/${projectId}/members`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                                    body: JSON.stringify({ user_id: m.user_id, permission: perm }),
                                  });
                                  const data = await res.json().catch(() => ({}));
                                  if (!res.ok) {
                                    setToast({ message: data.error || "Failed to update permission", error: true });
                                    return;
                                  }
                                  setMembers(Array.isArray(data) ? data : members);
                                  setToast({ message: "Permission updated" });
                                } catch {
                                  setToast({ message: "Failed to update permission", error: true });
                                }
                              }}
                            >
                              <option value="full_edit">Full edit</option>
                              <option value="edit">Edit</option>
                              <option value="comment">Comment</option>
                              <option value="view">View only</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Create Task Modal Component
function CreateTaskModal({
  newTask,
  setNewTask,
  sections,
  members,
  onClose,
  onCreate,
}: {
  newTask: any;
  setNewTask: (task: any) => void;
  sections: Section[];
  members: ProjectMember[];
  onClose: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-800">Create New Task</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            ✕
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <Input
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="Task title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              placeholder="Task description"
              rows={4}
              className="w-full px-3 py-2 border border-white/50 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none bg-white/80 backdrop-blur-sm text-sm text-slate-800"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Section *</label>
              <select
                value={newTask.section_id || ""}
                onChange={(e) => setNewTask({ ...newTask, section_id: Number(e.target.value) || null })}
                className="w-full px-3 py-2 border border-white/50 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none bg-white/80 backdrop-blur-sm"
              >
                <option value="">Select section</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                className="w-full px-3 py-2 border border-white/50 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none bg-white/80 backdrop-blur-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Assignee</label>
              <select
                value={newTask.assignee_id || ""}
                onChange={(e) => setNewTask({ ...newTask, assignee_id: Number(e.target.value) || null })}
                className="w-full px-3 py-2 border border-white/50 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none bg-white/80 backdrop-blur-sm"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.user?.name || m.user?.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
              <Input
                type="date"
                value={newTask.due_date}
                onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onCreate}
              disabled={!newTask.title.trim() || !newTask.section_id}
            >
              Create Task
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Task Detail Modal Component (reuse from tasks page)
function TaskDetailModal({
  task,
  sections,
  members,
  currentUser,
  onClose,
  onUpdate,
  projectId,
}: {
  task: Task;
  sections: Section[];
  members: ProjectMember[];
  currentUser: User | null;
  onClose: () => void;
  onUpdate: (taskId: number, updates: Partial<Task>) => Promise<void>;
  projectId: number;
}) {
  const [editing, setEditing] = useState(false);
  const [taskData, setTaskData] = useState(task);
  const [comments, setComments] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null);

  // Update taskData when task prop changes
  useEffect(() => {
    setTaskData(task);
    setEditing(false);
  }, [task.id]);

  useEffect(() => {
    loadComments();
    loadAttachments();
  }, [task.id]);

  async function loadComments() {
    try {
      const data = await taskService.getComments(task.id);
      setComments(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadAttachments() {
    try {
      const data = await taskService.getAttachments(task.id);
      setAttachments(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSave() {
    setLoading(true);
    try {
      // Format dates to YYYY-MM-DD format or null
      const formatDate = (date: string | null | undefined | Date): string | null => {
        if (!date || date === "") return null;
        // If it's already in YYYY-MM-DD format, return as is
        if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return date;
        }
        // Handle Date objects
        if (date instanceof Date) {
          if (isNaN(date.getTime())) return null;
          return date.toISOString().split("T")[0];
        }
        // Convert date string to YYYY-MM-DD
        try {
          const d = new Date(date);
          if (isNaN(d.getTime())) return null;
          return d.toISOString().split("T")[0];
        } catch {
          return null;
        }
      };

      // Prepare updates - format dates properly and handle section changes
      const updates: Partial<Task> = {
        title: taskData.title.trim(),
        description: taskData.description?.trim() || null,
        priority: taskData.priority,
        section_id: taskData.section_id,
        assignee_id: taskData.assignee_id || null,
      };

      // Format dates only if they exist
      if (taskData.due_date) {
        updates.due_date = formatDate(taskData.due_date as string | null);
      } else {
        updates.due_date = null;
      }

      if (taskData.start_date) {
        updates.start_date = formatDate(taskData.start_date as string | null);
      } else {
        updates.start_date = null;
      }

      // If moving to "Done" section, also update status to completed
      const selectedSection = sections.find((s) => s.id === taskData.section_id);
      if (selectedSection && selectedSection.name.toLowerCase().trim() === "done") {
        updates.status = "completed";
        console.log("Task moved to Done section, setting status to completed");
      } else if (task.status === "completed" && selectedSection && selectedSection.name.toLowerCase().trim() !== "done") {
        // If moving away from Done, set status back to on_track
        updates.status = "on_track";
        console.log("Task moved away from Done section, setting status to on_track");
      }

      console.log("Saving task updates:", updates);
      await onUpdate(task.id, updates);
      setEditing(false);
      // Reload task data to reflect changes
      const updatedTask = await taskService.getById(task.id);
      setTaskData(updatedTask);
      // Force reload of parent component data to update stats
      // This will be handled by onUpdate calling loadData(), but we ensure it happens
    } catch (err) {
      console.error("Error saving task:", err);
      alert(`Failed to save task: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddComment() {
    if (!newComment.trim()) return;
    try {
      await taskService.createComment(task.id, newComment.trim());
      setNewComment("");
      await loadComments();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const fileUrl = reader.result as string;
        await taskService.createAttachment(task.id, {
          file_name: file.name,
          file_url: fileUrl,
          file_type: file.type,
          file_size: file.size,
        });
        await loadAttachments();
        setUploadingFile(false);
        if (fileInput) fileInput.value = "";
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setUploadingFile(false);
    }
  }

  async function handleDeleteAttachment(attachmentId: number) {
    if (!confirm("Delete this attachment?")) return;
    try {
      await taskService.deleteAttachment(task.id, attachmentId);
      await loadAttachments();
    } catch (err) {
      console.error(err);
    }
  }

  function getAssigneeName(assigneeId: number | null) {
    if (!assigneeId) return null;
    const member = members.find((m) => m.user_id === assigneeId);
    return member?.user?.name || member?.user?.email || "Unknown";
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-800">Task Details</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Task Info */}
          <div className="space-y-3">
            {editing ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                  <Input
                    value={taskData.title}
                    onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    value={taskData.description || ""}
                    onChange={(e) => setTaskData({ ...taskData, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-white/50 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none bg-white/80 backdrop-blur-sm text-sm text-slate-800"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Section</label>
                    <select
                      value={taskData.section_id}
                      onChange={(e) => setTaskData({ ...taskData, section_id: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-white/50 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none bg-white/80 backdrop-blur-sm"
                    >
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                    <select
                      value={taskData.priority}
                      onChange={(e) => setTaskData({ ...taskData, priority: e.target.value as TaskPriority })}
                      className="w-full px-3 py-2 border border-white/50 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none bg-white/80 backdrop-blur-sm"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Assignee</label>
                    <select
                      value={taskData.assignee_id || ""}
                      onChange={(e) => setTaskData({ ...taskData, assignee_id: Number(e.target.value) || null })}
                      className="w-full px-3 py-2 border border-white/50 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none bg-white/80 backdrop-blur-sm"
                    >
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.user?.name || m.user?.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                    <Input
                      type="date"
                      value={
                        taskData.due_date
                          ? typeof taskData.due_date === "string"
                            ? taskData.due_date.includes("T")
                              ? taskData.due_date.split("T")[0]
                              : taskData.due_date
                            : new Date(taskData.due_date).toISOString().split("T")[0]
                          : ""
                      }
                      onChange={(e) => setTaskData({ ...taskData, due_date: e.target.value || null })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                  <Input
                    type="date"
                    value={
                      taskData.start_date
                        ? typeof taskData.start_date === "string"
                          ? taskData.start_date.includes("T")
                            ? taskData.start_date.split("T")[0]
                            : taskData.start_date
                          : new Date(taskData.start_date).toISOString().split("T")[0]
                        : ""
                    }
                    onChange={(e) => setTaskData({ ...taskData, start_date: e.target.value || null })}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(false);
                      // Reset to original task data
                      setTaskData(task);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleSave} disabled={loading} isLoading={loading}>
                    Save
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-800">{taskData.title}</h3>
                    {taskData.description && (
                      <p className="mt-2 text-sm text-slate-600">{taskData.description}</p>
                    )}
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Section:</span>{" "}
                    <span className="font-medium text-slate-800">
                      {sections.find((s) => s.id === taskData.section_id)?.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Priority:</span>{" "}
                    <span className="font-medium text-slate-800 capitalize">{taskData.priority}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Assignee:</span>{" "}
                    <span className="font-medium text-slate-800">
                      {getAssigneeName(taskData.assignee_id) || "Unassigned"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Due Date:</span>{" "}
                    <span className="font-medium text-slate-800">
                      {taskData.due_date ? new Date(taskData.due_date).toLocaleDateString() : "Not set"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Start Date:</span>{" "}
                    <span className="font-medium text-slate-800">
                      {taskData.start_date ? new Date(taskData.start_date).toLocaleDateString() : "Not set"}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Comments Section */}
          <div className="border-t border-white/30 pt-4">
            <h4 className="text-sm font-semibold text-slate-800 mb-3">Comments</h4>
            <div className="space-y-3 mb-3">
              {comments.map((comment) => (
                <div key={comment.id} className="p-3 bg-white/40 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-slate-800">
                      {comment.user?.name || comment.user?.email}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(comment.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">{comment.content}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
              />
              <Button variant="primary" size="sm" onClick={handleAddComment} disabled={!newComment.trim()}>
                Post
              </Button>
            </div>
          </div>

          {/* Attachments Section */}
          <div className="border-t border-white/30 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-800">Attachments</h4>
              <label className="cursor-pointer">
                <input
                  ref={(el) => setFileInput(el)}
                  type="file"
                  onChange={handleFileUpload}
                  disabled={uploadingFile}
                  className="hidden"
                />
                <Button variant="secondary" size="sm" disabled={uploadingFile} as="span">
                  {uploadingFile ? "Uploading..." : "+ Upload"}
                </Button>
              </label>
            </div>
            {attachments.length === 0 ? (
              <p className="text-sm text-slate-500">No attachments</p>
            ) : (
              <div className="space-y-2">
                {attachments.map((att) => (
                  <div key={att.id} className="flex items-center justify-between p-2 bg-white/40 rounded-lg">
                    <a
                      href={att.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-violet-700 hover:text-violet-800 flex items-center gap-2 flex-1"
                    >
                      📎 {att.file_name}
                    </a>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">
                        {att.file_size ? `${(att.file_size / 1024).toFixed(1)} KB` : ""}
                      </span>
                      {att.uploaded_by?.id === currentUser?.id && (
                        <button
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// Calendar View Component
function CalendarView({
  tasks,
  sections,
  members,
  getPriorityColor,
  getAssigneeName,
  isOverdue,
  onTaskClick,
}: {
  tasks: Task[];
  sections: Section[];
  members: ProjectMember[];
  getPriorityColor: (p: TaskPriority) => string;
  getAssigneeName: (id: number | null) => string | null;
  isOverdue: (date: string | null) => boolean;
  onTaskClick: (task: Task) => void;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  function getTasksForDate(date: Date) {
    const dateStr = date.toISOString().split("T")[0];
    return tasks.filter((task) => {
      if (!task.due_date) return false;
      const taskDate = new Date(task.due_date).toISOString().split("T")[0];
      return taskDate === dateStr;
    });
  }

  function changeMonth(delta: number) {
    setCurrentDate(new Date(year, month + delta, 1));
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const days: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, month, day));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={goToToday}>
            Today
          </Button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeMonth(-1)}
              className="p-2 hover:bg-white/60 rounded-lg transition-colors"
            >
              ←
            </button>
            <h3 className="text-lg font-semibold text-slate-800 min-w-[200px] text-center">
              {monthNames[month]} {year}
            </h3>
            <button
              onClick={() => changeMonth(1)}
              className="p-2 hover:bg-white/60 rounded-lg transition-colors"
            >
              →
            </button>
          </div>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-7 gap-1">
          {dayNames.map((day) => (
            <div key={day} className="p-2 text-center text-sm font-semibold text-slate-700 border-b border-white/30">
              {day}
            </div>
          ))}

          {days.map((date, idx) => {
            if (!date) {
              return <div key={`empty-${idx}`} className="min-h-[100px] p-2 bg-white/20 rounded" />;
            }

            const dayTasks = getTasksForDate(date);
            const isToday = date.toDateString() === new Date().toDateString();
            const isCurrentMonth = date.getMonth() === month;

            return (
              <div
                key={date.toISOString()}
                className={`min-h-[100px] p-2 rounded border ${
                  isToday
                    ? "bg-violet-50 border-violet-300"
                    : isCurrentMonth
                      ? "bg-white/40 border-white/30"
                      : "bg-white/20 border-white/20"
                }`}
              >
                <div className={`text-sm font-medium mb-1 ${isToday ? "text-violet-700" : "text-slate-700"}`}>
                  {date.getDate()}
                </div>
                <div className="space-y-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className={`text-xs p-1 rounded cursor-pointer hover:shadow-sm transition-all ${
                        isOverdue(task.due_date)
                          ? "bg-red-100 text-red-800 border border-red-300"
                          : getPriorityColor(task.priority)
                      }`}
                    >
                      <div className="font-medium truncate">{task.title}</div>
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="text-xs text-slate-500 px-1">
                      +{dayTasks.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {tasks.filter((t) => !t.due_date).length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-slate-800 mb-2">
            Unscheduled ({tasks.filter((t) => !t.due_date).length})
          </h3>
          <div className="space-y-1">
            {tasks.filter((t) => !t.due_date).map((task) => (
              <div
                key={task.id}
                onClick={() => onTaskClick(task)}
                className="p-2 bg-white/40 rounded-lg cursor-pointer hover:bg-white/60 transition-colors text-sm"
              >
                {task.title}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// Gantt View Component - ClickUp Style Timeline
function GanttView({
  tasks,
  sections,
  members,
  getPriorityColor,
  getAssigneeName,
  onTaskClick,
  onUpdateTask,
}: {
  tasks: Task[];
  sections: Section[];
  members: ProjectMember[];
  getPriorityColor: (p: TaskPriority) => string;
  getAssigneeName: (id: number | null) => string | null;
  onTaskClick: (task: Task) => void;
  onUpdateTask: (id: number, updates: Partial<Task>) => Promise<void>;
}) {
  const [currentWeek, setCurrentWeek] = useState(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    return startOfWeek;
  });
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());
  const [weeksToShow] = useState(12); // Show 12 weeks

  // Helper to get user initials
  function getUserInitials(userId: number | null): string {
    if (!userId) return "?";
    const member = members.find((m) => m.user_id === userId);
    if (!member?.user) return "?";
    const name = member.user.name || member.user.email;
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  // Helper to get user
  function getUser(userId: number | null) {
    if (!userId) return null;
    return members.find((m) => m.user_id === userId)?.user;
  }

  // Helper to format due date
  function formatDueDate(date: string | null): string {
    if (!date) return "";
    const taskDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    taskDate.setHours(0, 0, 0, 0);

    if (taskDate.getTime() === today.getTime()) return "Due today";
    if (taskDate.getTime() === tomorrow.getTime()) return "Due tomorrow";
    
    const diffDays = Math.ceil((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 7) {
      return `Due ${taskDate.toLocaleDateString("en-US", { weekday: "long" })}`;
    }
    
    return `Due ${taskDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }

  // Generate weeks
  function generateWeeks() {
    const weeks: Array<{ start: Date; end: Date; weekNum: number; month: string }> = [];
    const start = new Date(currentWeek);
    
    for (let i = 0; i < weeksToShow; i++) {
      const weekStart = new Date(start);
      weekStart.setDate(start.getDate() + i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      // Get week number (ISO week)
      const d = new Date(weekStart);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
      const week1 = new Date(d.getFullYear(), 0, 4);
      const weekNum = Math.ceil((((d.getTime() - week1.getTime()) / 86400000) + week1.getDay() + 1) / 7);
      
      const month = weekStart.toLocaleDateString("en-US", { month: "long" });
      weeks.push({ start: weekStart, end: weekEnd, weekNum, month });
    }
    
    return weeks;
  }

  const weeks = generateWeeks();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find today's week position
  const todayWeekIndex = weeks.findIndex((w) => {
    return today >= w.start && today <= w.end;
  });

  function navigateWeeks(delta: number) {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(currentWeek.getDate() + delta * 7);
    setCurrentWeek(newWeek);
  }

  function goToToday() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    setCurrentWeek(startOfWeek);
  }

  function toggleSection(sectionId: number) {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(sectionId)) {
      newCollapsed.delete(sectionId);
    } else {
      newCollapsed.add(sectionId);
    }
    setCollapsedSections(newCollapsed);
  }

  // Group tasks by section
  const tasksBySection = sections.reduce((acc, section) => {
    acc[section.id] = tasks.filter((t) => t.section_id === section.id);
    return acc;
  }, {} as Record<number, Task[]>);

  // Get task position in timeline (based on weeks)
  function getTaskPosition(task: Task) {
    if (!task.start_date && !task.due_date) return null;

    const start = task.start_date ? new Date(task.start_date) : new Date(task.due_date!);
    const end = task.due_date ? new Date(task.due_date) : new Date(task.start_date!);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const startWeekIdx = weeks.findIndex((w) => start >= w.start && start <= w.end);
    const endWeekIdx = weeks.findIndex((w) => end >= w.start && end <= w.end);

    if (startWeekIdx === -1 && endWeekIdx === -1) return null;

    const actualStartIdx = startWeekIdx >= 0 ? startWeekIdx : 0;
    const actualEndIdx = endWeekIdx >= 0 ? endWeekIdx : weeks.length - 1;

    const left = (actualStartIdx / weeks.length) * 100;
    const width = ((actualEndIdx - actualStartIdx + 1) / weeks.length) * 100;

    return { left: `${left}%`, width: `${width}%` };
  }

  // Group months
  const monthGroups: Record<string, number[]> = {};
  weeks.forEach((week, idx) => {
    if (!monthGroups[week.month]) {
      monthGroups[week.month] = [];
    }
    monthGroups[week.month].push(idx);
  });

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-white/30">
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => {}}>
            + Add task
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateWeeks(-1)}
            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-white/40 rounded-lg transition-colors"
          >
            ←
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => navigateWeeks(1)}
            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-white/40 rounded-lg transition-colors"
          >
            →
          </button>
          <span className="px-3 py-1.5 text-sm text-slate-600">No date (1)</span>
          <span className="px-3 py-1.5 text-sm text-slate-600 bg-white/40 rounded-lg">Weeks</span>
          <button className="px-2 py-1 text-sm text-slate-600 hover:text-slate-800 hover:bg-white/40 rounded transition-colors">
            -
          </button>
          <button className="px-2 py-1 text-sm text-slate-600 hover:text-slate-800 hover:bg-white/40 rounded transition-colors">
            +
          </button>
          <button className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-white/40 rounded-lg transition-colors">
            Filter
          </button>
          <button className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-white/40 rounded-lg transition-colors">
            Sort
          </button>
          <button className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-white/40 rounded-lg transition-colors">
            Options
          </button>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="bg-white/30 backdrop-blur-sm rounded-lg border border-white/50 overflow-x-auto">
        <div className="min-w-[1200px]">
          {/* Timeline Header */}
          <div className="grid grid-cols-[200px_1fr] border-b border-white/30">
            <div className="p-3 font-semibold text-slate-700 bg-white/50">Task</div>
            <div className="relative">
              {/* Month Row */}
              <div className="flex border-b border-white/30">
                {Object.entries(monthGroups).map(([month, indices]) => {
                  const startIdx = indices[0];
                  const endIdx = indices[indices.length - 1];
                  const span = ((endIdx - startIdx + 1) / weeks.length) * 100;
                  const left = (startIdx / weeks.length) * 100;

                  return (
                    <div
                      key={month}
                      className="px-2 py-2 text-sm font-medium text-slate-700 border-r border-white/30"
                      style={{ width: `${span}%`, marginLeft: startIdx === 0 ? 0 : `${left}%` }}
                    >
                      {month}
                    </div>
                  );
                })}
              </div>
              {/* Week Row */}
              <div className="flex relative">
                {weeks.map((week, idx) => {
                  const weekWidth = 100 / weeks.length;
                  const isTodayWeek = idx === todayWeekIndex;

                  return (
                    <div
                      key={idx}
                      className="border-r border-white/30 px-2 py-2 text-xs text-slate-600 relative"
                      style={{ width: `${weekWidth}%` }}
                    >
                      <div className="font-medium">W{week.weekNum}</div>
                      <div className="text-slate-500">
                        {week.start.getDate()}-{week.end.getDate()}
                      </div>
                      {isTodayWeek && (
                        <div className="absolute top-0 bottom-0 left-0 w-0.5 bg-orange-500 z-10" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sections and Tasks */}
          <div>
            {sections.map((section) => {
              const sectionTasks = tasksBySection[section.id] || [];
              const isCollapsed = collapsedSections.has(section.id);

              return (
                <div key={section.id} className="border-b border-white/20 last:border-b-0">
                  {/* Section Header */}
                  <div
                    className="grid grid-cols-[200px_1fr] hover:bg-white/20 cursor-pointer transition-colors"
                    onClick={() => toggleSection(section.id)}
                  >
                    <div className="p-3 flex items-center gap-2">
                      <span className={`text-sm transition-transform ${isCollapsed ? "" : "rotate-90"}`}>
                        ▶
                      </span>
                      <span className="font-medium text-slate-700">{section.name}</span>
                    </div>
                    <div className="p-3"></div>
                  </div>

                  {/* Tasks */}
                  {!isCollapsed && (
                    <div>
                      {sectionTasks.map((task) => {
                        const position = getTaskPosition(task);
                        const assignee = getUser(task.assignee_id);
                        const isCompleted = task.status === "completed";

                        if (!position) {
                          return (
                            <div
                              key={task.id}
                              className="grid grid-cols-[200px_1fr] border-b border-white/10 hover:bg-white/20"
                            >
                              <div className="p-3 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-300 text-white text-xs flex items-center justify-center font-medium">
                                  {assignee ? getUserInitials(task.assignee_id) : "?"}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className={`text-sm ${isCompleted ? "line-through text-slate-500" : "text-slate-800"}`}>
                                    {task.title}
                                  </div>
                                  {task.due_date && (
                                    <div className="text-xs text-slate-500">{formatDueDate(task.due_date)}</div>
                                  )}
                                </div>
                              </div>
                              <div className="p-3 text-xs text-slate-400 italic">No dates set</div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={task.id}
                            className="grid grid-cols-[200px_1fr] border-b border-white/10 hover:bg-white/20 relative"
                          >
                            <div className="p-3 flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-medium ${
                                isCompleted ? "bg-green-500" : "bg-violet-500"
                              }`}>
                                {assignee ? getUserInitials(task.assignee_id) : "?"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm truncate ${isCompleted ? "line-through text-slate-500" : "text-slate-800"}`}>
                                  {task.title}
                                </div>
                                {task.due_date && (
                                  <div className="text-xs text-slate-500">{formatDueDate(task.due_date)}</div>
                                )}
                              </div>
                            </div>
                            <div className="relative p-3" style={{ minHeight: "48px" }}>
                              <div
                                onClick={() => onTaskClick(task)}
                                className={`absolute top-2 bottom-2 rounded cursor-pointer hover:shadow-md transition-all flex items-center gap-2 px-2 ${
                                  task.priority === "high"
                                    ? "bg-red-200 border border-red-300"
                                    : task.priority === "medium"
                                    ? "bg-yellow-200 border border-yellow-300"
                                    : task.priority === "low"
                                    ? "bg-green-200 border border-green-300"
                                    : "bg-slate-200 border border-slate-300"
                                }`}
                                style={{
                                  left: position.left,
                                  width: position.width,
                                  minWidth: "80px",
                                }}
                              >
                                <div className="w-5 h-5 rounded-full bg-white text-violet-600 text-xs flex items-center justify-center font-medium flex-shrink-0">
                                  {assignee ? getUserInitials(task.assignee_id) : "?"}
                                </div>
                                <span className="text-xs font-medium text-slate-800 truncate flex-1">
                                  {task.title}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {sectionTasks.length === 0 && (
                        <div className="grid grid-cols-[200px_1fr] p-3 text-sm text-slate-400">
                          <div></div>
                          <div className="text-center">Click anywhere to create a task</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Table View Component
function TableView({
  tasks,
  sections,
  members,
  getPriorityColor,
  getAssigneeName,
  isOverdue,
  onTaskClick,
  onUpdateTask,
}: {
  tasks: Task[];
  sections: Section[];
  members: ProjectMember[];
  getPriorityColor: (p: TaskPriority) => string;
  getAssigneeName: (id: number | null) => string | null;
  isOverdue: (date: string | null) => boolean;
  onTaskClick: (task: Task) => void;
  onUpdateTask: (id: number, updates: Partial<Task>) => Promise<void>;
}) {
  const [sortBy, setSortBy] = useState<"title" | "due_date" | "priority" | "section">("section");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const sortedTasks = [...tasks].sort((a, b) => {
    let aVal: any, bVal: any;

    switch (sortBy) {
      case "title":
        aVal = a.title.toLowerCase();
        bVal = b.title.toLowerCase();
        break;
      case "due_date":
        aVal = a.due_date ? new Date(a.due_date).getTime() : 0;
        bVal = b.due_date ? new Date(b.due_date).getTime() : 0;
        break;
      case "priority":
        const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1, urgent: 3 };
        aVal = priorityOrder[a.priority] ?? 0;
        bVal = priorityOrder[b.priority] ?? 0;
        break;
      case "section":
        aVal = sections.findIndex((s) => s.id === a.section_id);
        bVal = sections.findIndex((s) => s.id === b.section_id);
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
    if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  function handleSort(field: typeof sortBy) {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/30">
              <th className="text-left p-3 text-sm font-semibold text-slate-700">
                <button
                  onClick={() => handleSort("title")}
                  className="flex items-center gap-1 hover:text-violet-700"
                >
                  Name
                  {sortBy === "title" && (sortOrder === "asc" ? "↑" : "↓")}
                </button>
              </th>
              <th className="text-left p-3 text-sm font-semibold text-slate-700">
                <button
                  onClick={() => handleSort("section")}
                  className="flex items-center gap-1 hover:text-violet-700"
                >
                  Section
                  {sortBy === "section" && (sortOrder === "asc" ? "↑" : "↓")}
                </button>
              </th>
              <th className="text-left p-3 text-sm font-semibold text-slate-700">Assignee</th>
              <th className="text-left p-3 text-sm font-semibold text-slate-700">
                <button
                  onClick={() => handleSort("due_date")}
                  className="flex items-center gap-1 hover:text-violet-700"
                >
                  Due Date
                  {sortBy === "due_date" && (sortOrder === "asc" ? "↑" : "↓")}
                </button>
              </th>
              <th className="text-left p-3 text-sm font-semibold text-slate-700">
                <button
                  onClick={() => handleSort("priority")}
                  className="flex items-center gap-1 hover:text-violet-700"
                >
                  Priority
                  {sortBy === "priority" && (sortOrder === "asc" ? "↑" : "↓")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedTasks.map((task) => {
              const section = sections.find((s) => s.id === task.section_id);
              return (
                <tr
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  className="border-b border-white/30 hover:bg-white/40 cursor-pointer transition-colors"
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateTask(task.id, {
                            status: task.status === "completed" ? "on_track" : "completed",
                          });
                        }}
                        className="w-5 h-5 rounded-full border-2 border-dashed border-slate-500 shrink-0 flex items-center justify-center hover:border-violet-500 hover:bg-violet-50/80 transition-colors cursor-pointer"
                        title={task.status === "completed" ? "Mark incomplete" : "Mark complete"}
                      >
                        {task.status === "completed" && (
                          <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                        )}
                      </button>
                      <span className={`font-medium ${task.status === "completed" ? "line-through text-slate-500" : "text-slate-800"}`}>
                        {task.title}
                      </span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="text-sm text-slate-600">{section?.name || "Unknown"}</span>
                  </td>
                  <td className="p-3">
                    <span className="text-sm text-slate-600">
                      {getAssigneeName(task.assignee_id) || "Unassigned"}
                    </span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`text-sm ${
                        isOverdue(task.due_date) ? "text-red-600 font-medium" : "text-slate-600"
                      }`}
                    >
                      {task.due_date ? new Date(task.due_date).toLocaleDateString() : "-"}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  </td>
                </tr>
              );
            })}
            {sortedTasks.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  No tasks found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
