import { apiFetch } from "@/lib/api";

export async function reportProject(projectId, reason) {
  return apiFetch(`/projects/${projectId}/report`, { method: "POST", body: { reason }, auth: true });
}
export async function reportUser(userId, reason) {
  return apiFetch(`/users/${userId}/report`, { method: "POST", body: { reason }, auth: true });
}
export async function removeMember(projectId, userId) {
  return apiFetch(`/projects/${projectId}/members/${userId}`, { method: "DELETE", auth: true });
}

// admin
export async function listReports(status = "open") {
  return apiFetch(`/admin/reports?status=${status}`, { auth: true });
}
export async function dismissReport(reportId) {
  return apiFetch(`/admin/reports/${reportId}/dismiss`, { method: "POST", auth: true });
}
export async function suspendProjectByReport(reportId) {
  return apiFetch(`/admin/reports/${reportId}/suspend-project`, { method: "POST", auth: true });
}
export async function banUserByReport(reportId) {
  return apiFetch(`/admin/reports/${reportId}/ban-user`, { method: "POST", auth: true });
}
export async function reinstateProject(projectId) {
  return apiFetch(`/admin/projects/${projectId}/reinstate`, { method: "POST", auth: true });
}
export async function unbanUser(userId) {
  return apiFetch(`/admin/users/${userId}/unban`, { method: "POST", auth: true });
}