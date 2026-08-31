import { apiFetch } from "@/lib/api";

export async function listMyInvitations() {
  return apiFetch("/invitations", { auth: true });
}
export async function acceptInvitation(id) {
  return apiFetch(`/invitations/${id}/accept`, { method: "POST", auth: true });
}
export async function declineInvitation(id) {
  return apiFetch(`/invitations/${id}/decline`, { method: "POST", auth: true });
}