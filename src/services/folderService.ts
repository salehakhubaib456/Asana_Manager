import { apiGet, apiPost } from "./api";
import { API_ROUTES } from "@/constants";
import type { Folder } from "@/types";

export const folderService = {
  list: () => apiGet<Folder[]>(API_ROUTES.FOLDERS),
  // Optional space_id lets us create folders either in the default
  // workspace (space_id = null) or under a specific space.
  create: (body: { name: string; space_id?: number | null }) => apiPost<Folder>(API_ROUTES.FOLDERS, body),
};
