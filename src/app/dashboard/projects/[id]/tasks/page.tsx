"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, Button, Input } from "@/components/ui";
import { projectService } from "@/services/projectService";
import { taskService } from "@/services/taskService";
import { authService } from "@/services/authService";
import type { Project, Section, Task, ProjectMember, TaskPriority, TaskStatus, User } from "@/types";

export default function ProjectTasksPage() {
  const params = useParams();
  const projectId = Number(params.id);
  const [project, setProject] = useState<Project | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

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

  async function loadData() {
    try {
      const [projectData, sectionsData, tasksData, membersData] = await Promise.all([
        projectService.getById(projectId),
        projectService.getSections(projectId),
        taskService.listByProject(projectId),
        projectService.getMembers(projectId),
      ]);
      setProject(projectData);
      setSections(sectionsData.sort((a, b) => a.position - b.position));
      setTasks(tasksData);
      setMembers(membersData);
      try {
        const me = await authService.me();
        setCurrentUser(me);
      } catch {}
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTask() {
    if (!newTask.title.trim() || !newTask.section_id) return;
    try {
      const created = await taskService.create({
        project_id: projectId,
        section_id: newTask.section_id,
        title: newTask.title.trim(),
        description: newTask.description.trim() || null,
        priority: newTask.priority,
        assignee_id: newTask.assignee_id,
        due_date: newTask.due_date || null,
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

  async function handleUpdateTask(taskId: number, updates: Partial<Task>) {
    try {
      await taskService.update(taskId, updates);
      await loadData();
      if (selectedTask?.id === taskId) {
        setSelectedTask({ ...selectedTask, ...updates });
      }
    } catch (err) {
      console.error(err);
    }
  }

  function getTasksBySection(sectionId: number) {
    return tasks.filter((t) => t.section_id === sectionId);
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
        <p className="text-slate-600">Loading tasks...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{project?.name} - Tasks</h1>
          <p className="mt-1 text-sm text-slate-600">Manage and track project tasks</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreateTask(true)}>
          + Create Task
        </Button>
      </div>

      {/* Create Task Modal */}
      {showCreateTask && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Create New Task</h2>
              <button
                onClick={() => setShowCreateTask(false)}
                className="text-slate-500 hover:text-slate-700"
              >
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
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as TaskPriority })}
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
                <Button variant="ghost" size="sm" onClick={() => setShowCreateTask(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreateTask}
                  disabled={!newTask.title.trim() || !newTask.section_id}
                >
                  Create Task
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Task Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sections.map((section) => {
          const sectionTasks = getTasksBySection(section.id);
          return (
            <Card key={section.id} className="min-h-[400px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">{section.name}</h3>
                <span className="text-sm text-slate-500 bg-white/40 px-2 py-1 rounded">
                  {sectionTasks.length}
                </span>
              </div>
              <div className="space-y-2">
                {sectionTasks.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">No tasks</p>
                ) : (
                  sectionTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className="p-3 bg-white/40 backdrop-blur-sm rounded-lg border border-white/30 cursor-pointer hover:bg-white/60 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-slate-800 text-sm flex-1">{task.title}</h4>
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-medium border ${getPriorityColor(task.priority)}`}
                        >
                          {task.priority}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-xs text-slate-600 mb-2 line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        {task.assignee_id && (
                          <span>👤 {getAssigneeName(task.assignee_id)}</span>
                        )}
                        {task.due_date && (
                          <span className={isOverdue(task.due_date) ? "text-red-600 font-medium" : ""}>
                            📅 {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          );
        })}
      </div>

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
    </div>
  );
}

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
      await onUpdate(task.id, taskData);
      setEditing(false);
    } catch (err) {
      console.error(err);
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
      // In production, upload to S3/Cloudinary/etc and get URL
      // For now, we'll create a data URL or use a placeholder
      // This is a simplified version - you'd need proper file storage
      const reader = new FileReader();
      reader.onloadend = async () => {
        const fileUrl = reader.result as string;
        // In production: const fileUrl = await uploadToStorage(file);
        
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
                      value={taskData.due_date || ""}
                      onChange={(e) => setTaskData({ ...taskData, due_date: e.target.value || null })}
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setTaskData(task); }}>
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
