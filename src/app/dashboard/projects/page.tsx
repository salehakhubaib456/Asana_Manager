"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Button, Input } from "@/components/ui";
import { ROUTES } from "@/constants";
import { projectService } from "@/services/projectService";
import { useFavoritesStore } from "@/store";
import type { Project } from "@/types";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const { favorites, addFavorite, removeFavorite } = useFavoritesStore();

  function isFav(id: number) {
    return favorites.some((f) => f.type === "project" && f.id === id);
  }
  function toggleFav(e: React.MouseEvent, p: Project) {
    e.preventDefault();
    e.stopPropagation();
    if (isFav(p.id)) removeFavorite("project", p.id);
    else addFavorite({ type: "project", id: p.id, name: p.name });
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const data = await projectService.list();
      setProjects(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!projectName.trim()) {
      setError("Project name is required");
      return;
    }
    setCreating(true);
    try {
      const newProject = await projectService.create({
        name: projectName.trim(),
        description: projectDescription.trim() || null,
        status: "on_track",
      });
      setShowCreateForm(false);
      setProjectName("");
      setProjectDescription("");
      await loadProjects();
      router.push(ROUTES.PROJECT_DETAIL(newProject.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Projects</h1>
        <Button
          variant="primary"
          onClick={() => setShowCreateForm(!showCreateForm)}
          disabled={creating}
        >
          + Create Project
        </Button>
      </div>

      {showCreateForm && (
        <Card className="mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Create New Project</h2>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
          <form onSubmit={handleCreateProject} className="space-y-4">
            <Input
              label="Project Name"
              type="text"
              placeholder="My Project"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              required
              className="bg-white"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Project description..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={creating} isLoading={creating}>
                Create Project
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowCreateForm(false);
                  setProjectName("");
                  setProjectDescription("");
                  setError("");
                }}
                disabled={creating}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <p className="text-slate-600">Loading...</p>
      ) : projects.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-slate-600 mb-4">No projects yet. Create one to get started!</p>
          <Button variant="primary" onClick={() => setShowCreateForm(true)}>
            + Create Your First Project
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={ROUTES.PROJECT_DETAIL(project.id)}>
              <Card className="hover:border-violet-400 hover:shadow-xl transition-all cursor-pointer relative">
                <button
                  type="button"
                  onClick={(e) => toggleFav(e, project)}
                  className="absolute top-2 right-2 p-1 rounded text-slate-400 hover:text-amber-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  aria-label={isFav(project.id) ? "Remove from favorites" : "Add to favorites"}
                  title={isFav(project.id) ? "Remove from favorites" : "Add to favorites"}
                >
                  {isFav(project.id) ? "⭐" : "☆"}
                </button>
                <h3 className="font-medium text-slate-800 pr-6">{project.name}</h3>
                {project.description && (
                  <p className="mt-1 text-sm text-slate-600 line-clamp-2">{project.description}</p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    project.status === "on_track"
                      ? "bg-green-100 text-green-700"
                      : project.status === "at_risk"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                  }`}>
                    {project.status.replace("_", " ")}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
