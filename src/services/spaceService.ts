import { apiGet, apiPost } from "./api";
import { API_ROUTES } from "@/constants";
import type { Space } from "@/types";

export const spaceService = {
  list: () => apiGet<Space[]>(API_ROUTES.SPACES),
  create: (body: { name: string; description?: string; default_permission?: string; is_private?: boolean }) =>
    apiPost<Space>(API_ROUTES.SPACES, body),
};
