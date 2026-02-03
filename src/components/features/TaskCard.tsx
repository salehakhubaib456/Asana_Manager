"use client";

import { Card } from "@/components/ui";
import type { Task } from "@/types";

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  return (
    <Card
      padding="sm"
      className="cursor-pointer hover:border-blue-300 transition-colors"
      onClick={onClick}
    >
      <p className="font-medium text-gray-900">{task.title}</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
        <span className="capitalize">{task.priority}</span>
        <span>·</span>
        <span className="capitalize">{task.status.replace("_", " ")}</span>
        {task.due_date && (
          <>
            <span>·</span>
            <span>{new Date(task.due_date).toLocaleDateString()}</span>
          </>
        )}
      </div>
    </Card>
  );
}
