import { apiFetch } from "@/lib/api";

export async function listNotifications() {
  return apiFetch("/notifications", { auth: true }); // -> { notifications: [...], unread: n }
}

export async function markNotificationRead(id) {
  return apiFetch(`/notifications/${id}/read`, { method: "POST", auth: true });
}

export async function markAllNotificationsRead() {
  return apiFetch("/notifications/read-all", { method: "POST", auth: true });
}