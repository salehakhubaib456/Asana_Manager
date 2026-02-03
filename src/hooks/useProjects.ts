"use client";

import { useCallback } from "react";
import { useProjectStore } from "@/store";
import { projectService } from "@/services/projectService";

export function useProjectsFetch() {
  const { setProjects } = useProjectStore();

  const fetchProjects = useCallback(async () => {
    const list = await projectService.list();
    setProjects(list);
    return list;
  }, [setProjects]);

  return { fetchProjects };
}

export { useProjectStore } from "@/store";
