"use client";

import { useEffect, useState } from "react";
import { Card, Button } from "@/components/ui";
import { projectService } from "@/services/projectService";
import { taskService } from "@/services/taskService";
import { ROUTES } from "@/constants";
import Link from "next/link";
import type { Project, Task } from "@/types";

export default function TasksPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const projectsData = await projectService.list();
      setProjects(projectsData);
      
      // Load tasks from all projects
      const tasksPromises = projectsData.map((p) => taskService.listByProject(p.id));
      const tasksArrays = await Promise.all(tasksPromises);
      const flatTasks = tasksArrays.flat();
      setAllTasks(flatTasks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function getProjectName(projectId: number) {
    return projects.find((p) => p.id === projectId)?.name || "Unknown Project";
  }

  function getPriorityColor(priority: string) {
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

  function isOverdue(dueDate: string | null) {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-slate-600">Loading tasks...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">All Tasks</h1>
        <p className="mt-1 text-sm text-slate-600">View and manage tasks across all projects</p>
      </div>

      {allTasks.length === 0 ? (
        <Card>
          <p className="text-slate-600 text-center py-8">No tasks found. Create a project and add tasks to get started.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {allTasks.map((task) => (
            <Card key={task.id} className="hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-slate-800">{task.title}</h3>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium border ${getPriorityColor(task.priority)}`}
                    >
                      {task.priority}
                    </span>
                  </div>
                  {task.description && (
                    <p className="text-sm text-slate-600 mb-2 line-clamp-2">{task.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>📁 {getProjectName(task.project_id)}</span>
                    {task.due_date && (
                      <span className={isOverdue(task.due_date) ? "text-red-600 font-medium" : ""}>
                        📅 {new Date(task.due_date).toLocaleDateString()}
                        {isOverdue(task.due_date) && " (Overdue)"}
                      </span>
                    )}
                    <span>Created: {new Date(task.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <Link href={`${ROUTES.PROJECT_DETAIL(task.project_id)}/tasks`}>
                  <Button variant="secondary" size="sm">
                    View →
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
