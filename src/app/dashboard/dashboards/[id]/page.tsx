"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, Button } from "@/components/ui";
import { ROUTES } from "@/constants";
import { dashboardService } from "@/services/dashboardService";
import { projectService } from "@/services/projectService";
import { taskService } from "@/services/taskService";
import { authService } from "@/services/authService";
import type { Dashboard, Task, Project, User } from "@/types";

export default function DashboardDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadData();
      }, 60000); // Refresh every minute
      return () => clearInterval(interval);
    }
  }, [autoRefresh, id]);

  async function loadData() {
    try {
      const [dashboardData, projectsData, userData] = await Promise.all([
        dashboardService.getById(id),
        projectService.list(),
        authService.me().catch(() => null),
      ]);
      setDashboard(dashboardData);
      setProjects(projectsData);
      setCurrentUser(userData);

      // Load all tasks from all projects
      const tasksPromises = projectsData.map((p) => taskService.listByProject(p.id).catch(() => []));
      const tasksArrays = await Promise.all(tasksPromises);
      const flatTasks = tasksArrays.flat();
      setAllTasks(flatTasks);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  // Calculate statistics
  const unassignedTasks = allTasks.filter((t) => !t.assignee_id && t.status !== "completed");
  const inProgressTasks = allTasks.filter((t) => t.status === "on_track" && !t.deleted_at);
  const completedTasks = allTasks.filter((t) => t.status === "completed" && !t.deleted_at);

  // Tasks due this week or overdue
  const now = new Date();
  const weekFromNow = new Date(now);
  weekFromNow.setDate(now.getDate() + 7);
  const tasksDueThisWeekOrOverdue = allTasks.filter((t) => {
    if (!t.due_date || t.status === "completed" || t.deleted_at) return false;
    const dueDate = new Date(t.due_date);
    return dueDate <= weekFromNow;
  });

  // Group tasks by assignee for charts
  const tasksByAssignee: Record<number, Task[]> = {};
  allTasks.forEach((task) => {
    if (task.assignee_id && !task.deleted_at) {
      if (!tasksByAssignee[task.assignee_id]) {
        tasksByAssignee[task.assignee_id] = [];
      }
      tasksByAssignee[task.assignee_id].push(task);
    }
  });

  const openTasksByAssignee: Record<number, Task[]> = {};
  allTasks.forEach((task) => {
    if (task.assignee_id && task.status !== "completed" && !task.deleted_at) {
      if (!openTasksByAssignee[task.assignee_id]) {
        openTasksByAssignee[task.assignee_id] = [];
      }
      openTasksByAssignee[task.assignee_id].push(task);
    }
  });

  // Get user name helper
  function getUserName(userId: number | null): string {
    if (!userId) return "Unassigned";
    // In a real app, you'd fetch user details - for now return placeholder
    return `User ${userId}`;
  }

  function formatTimeAgo(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  }

  function formatDueDate(date: string | null): string {
    if (!date) return "";
    const d = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDate = new Date(d);
    taskDate.setHours(0, 0, 0, 0);
    if (taskDate.getTime() === today.getTime()) return "Today";
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (taskDate.getTime() === tomorrow.getTime()) return "Tomorrow";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function isOverdue(date: string | null): boolean {
    if (!date) return false;
    return new Date(date) < new Date() && new Date(date).toDateString() !== new Date().toDateString();
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error || "Dashboard not found"}</p>
        <Link href={ROUTES.DASHBOARD}>
          <Button variant="secondary" className="mt-4">Back to Dashboards</Button>
        </Link>
      </div>
    );
  }

  const unassignedPercentage = allTasks.length > 0 ? Math.round((unassignedTasks.length / allTasks.length) * 100) : 0;
  const maxOpenTasks = Math.max(...Object.values(openTasksByAssignee).map((tasks) => tasks.length), 0);

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-4">
          <Link href={ROUTES.DASHBOARD} className="text-slate-600 hover:text-slate-800 text-sm">
            ← Dashboards
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-800">{dashboard.name}</h1>
            <button className="text-slate-400 hover:text-yellow-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>Edit mode</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={editMode}
                onChange={(e) => setEditMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-violet-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
            </label>
          </div>
          <Button variant="secondary" size="sm">Schedule report</Button>
          <Button variant="secondary" size="sm">Share</Button>
          <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
          <Link href={ROUTES.DASHBOARD}>
            <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </Link>
        </div>
      </div>

      {/* Refresh Status Bar */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="text-slate-600">Refreshed {formatTimeAgo(lastRefresh)}</span>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1 rounded ${autoRefresh ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"}`}
          >
            Auto refresh: {autoRefresh ? "On" : "Off"}
          </button>
          <button className="px-3 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200">Filters</button>
          {editMode && (
            <Button variant="primary" size="sm">Add card</Button>
          )}
        </div>
      </div>

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Tasks by Assignee - Pie Chart */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Total Tasks by Assignee</h3>
            <div className="flex items-center gap-1">
              <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex items-center justify-center py-8">
            <div className="relative w-32 h-32">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="16"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="16"
                  strokeDasharray={`${(unassignedPercentage / 100) * 351.86} 351.86`}
                  strokeDashoffset="0"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-800">{unassignedTasks.length}</div>
                  <div className="text-xs text-slate-500">Unassigned</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <div className="text-sm text-slate-600">Unassigned {unassignedPercentage}%</div>
          </div>
        </Card>

        {/* Open Tasks by Assignee - Bar Chart */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Open Tasks by Assignee</h3>
            <div className="flex items-center gap-1">
              <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-end gap-2 h-32">
              <div className="flex-1 flex flex-col items-center justify-end">
                <div
                  className="w-full bg-violet-500 rounded-t"
                  style={{ height: `${maxOpenTasks > 0 ? (unassignedTasks.length / Math.max(maxOpenTasks, 1)) * 100 : 0}%` }}
                ></div>
                <div className="mt-2 text-xs text-slate-600 text-center">Unassigned</div>
              </div>
              {Object.entries(openTasksByAssignee).slice(0, 3).map(([userId, tasks]) => (
                <div key={userId} className="flex-1 flex flex-col items-center justify-end">
                  <div
                    className="w-full bg-slate-400 rounded-t"
                    style={{ height: `${maxOpenTasks > 0 ? (tasks.length / maxOpenTasks) * 100 : 0}%` }}
                  ></div>
                  <div className="mt-2 text-xs text-slate-600 text-center truncate w-full">{getUserName(Number(userId))}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-200 pt-2">
              <span>Tasks</span>
              <div className="flex gap-4">
                {[0, 2, 4, 6].map((num) => (
                  <span key={num}>{num}</span>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Task Status Cards */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Tasks</h3>
            <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-medium">
                {unassignedTasks.length}
              </div>
              <div className="flex items-center gap-2 flex-1">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-sm text-slate-700">Unassigned</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium">
                {inProgressTasks.length}
              </div>
              <div className="flex items-center gap-2 flex-1">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-slate-700">In Progress</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-medium">
                {completedTasks.length}
              </div>
              <div className="flex items-center gap-2 flex-1">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-slate-700">Completed</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200">
            <select className="w-full text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1">
              <option>Calculate</option>
            </select>
          </div>
        </Card>
      </div>

      {/* Bottom Row - Tasks Due and Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tasks Due This Week or Overdue */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Tasks Due This Week or Overdue</h3>
          </div>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <button className="px-3 py-1 text-sm rounded bg-violet-100 text-violet-700">Group: Due date</button>
            <button className="px-3 py-1 text-sm rounded bg-slate-100 text-slate-600 hover:bg-slate-200">Subtasks</button>
            <button className="px-3 py-1 text-sm rounded bg-violet-100 text-violet-700">2 Filters</button>
            <button className="px-3 py-1 text-sm rounded bg-violet-100 text-violet-700">Closed</button>
            <input
              type="text"
              placeholder="Search..."
              className="flex-1 min-w-[120px] px-3 py-1 text-sm border border-slate-200 rounded bg-white"
            />
            <button className="px-3 py-1 text-sm rounded bg-slate-100 text-slate-600 hover:bg-slate-200">Customize</button>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {tasksDueThisWeekOrOverdue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-slate-500 text-sm">No matching results</p>
              </div>
            ) : (
              tasksDueThisWeekOrOverdue.map((task) => {
                const project = projects.find((p) => p.id === task.project_id);
                return (
                  <div
                    key={task.id}
                    className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                    onClick={() => window.location.href = ROUTES.PROJECT_DETAIL(task.project_id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <input type="checkbox" className="rounded" />
                          <span className="text-sm font-medium text-slate-800">{task.title}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 ml-6">
                          {project && <span>{project.name}</span>}
                          {task.due_date && (
                            <span className={isOverdue(task.due_date) ? "text-red-600 font-medium" : ""}>
                              {formatDueDate(task.due_date)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Latest Activity */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Latest Activity</h3>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Refreshed {formatTimeAgo(lastRefresh)}</span>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-2 py-0.5 rounded text-xs ${autoRefresh ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"}`}
              >
                Auto refresh: {autoRefresh ? "On" : "Off"}
              </button>
              <button className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600 hover:bg-slate-200">Filters</button>
              {editMode && (
                <Button variant="primary" size="sm">Add card</Button>
              )}
            </div>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {allTasks.length === 0 ? (
              <div className="text-sm text-slate-500 py-4">No activity yet</div>
            ) : (
              <>
                <div className="text-xs font-semibold text-slate-600 mb-2">Today</div>
                {allTasks
                  .filter((t) => {
                    const updated = new Date(t.updated_at);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return updated >= today;
                  })
                  .slice(0, 5)
                  .map((task) => {
                    const project = projects.find((p) => p.id === task.project_id);
                    return (
                      <div key={task.id} className="text-sm text-slate-700 border-l-2 border-slate-200 pl-3 py-1">
                        <div className="font-medium">{task.title}</div>
                        <div className="text-xs text-slate-500">
                          {project?.name} • {formatTimeAgo(new Date(task.updated_at))}
                        </div>
                      </div>
                    );
                  })}
                {allTasks.filter((t) => {
                  const updated = new Date(t.updated_at);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return updated >= today;
                }).length === 0 && (
                  <div className="text-sm text-slate-500 py-4">No activity today</div>
                )}
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
