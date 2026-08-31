import { apiFetch } from "@/lib/api";

export async function searchUsers(query, projectId) {
  const params = new URLSearchParams({ q: query });
  if (projectId) params.set("project_id", projectId);
  return apiFetch(`/users/search?${params.toString()}`, { auth: true });
}