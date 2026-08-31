import { apiFetch } from "@/lib/api";

export async function setSectionStatus(sectionId, status) {
  return apiFetch(`/sections/${sectionId}/status`, {
    method: "PATCH",
    body: { status },
    auth: true,
  });
}

export async function assignSection(sectionId, userIds) {
  return apiFetch(`/sections/${sectionId}/assign`, {
    method: "POST",
    body: { user_ids: userIds },
    auth: true,
  });
}


export async function submitSectionForReview(sectionId) {
  return apiFetch(`/sections/${sectionId}/submit`, { method: "POST", auth: true });
}

export async function reviewSection(sectionId, approve) {
  return apiFetch(`/sections/${sectionId}/review`, {
    method: "POST",
    body: { approve },
    auth: true,
  });
}


export async function editSection(sectionId, { title, description }) {
  return apiFetch(`/sections/${sectionId}`, {
    method: "PATCH",
    body: { title, description },
    auth: true,
  });
}

export async function deleteSection(sectionId) {
  return apiFetch(`/sections/${sectionId}`, { method: "DELETE", auth: true });
}



export async function setSectionSchedule(sectionId, { predecessorIds, dueAt, durationHours }) {
  return apiFetch(`/sections/${sectionId}/schedule`, {
    method: "PATCH",
    body: {
      predecessor_ids: predecessorIds,
      due_at: dueAt,
      duration_hours: durationHours,
    },
    auth: true,
  });
}