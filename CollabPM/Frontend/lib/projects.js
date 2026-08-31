import { apiFetch } from "@/lib/api";

export async function listProjects() {
  return apiFetch("/projects", { auth: true }); // -> { projects: [...] }
}

export async function getProject(projectId) {
  return apiFetch(`/projects/${projectId}`, { auth: true }); // -> { project: {...} }
}

export async function createProject({ name, description }) {
  return apiFetch("/projects", {
    method: "POST",
    body: { name, description },
    auth: true,
  }); // -> { project: {...} }
}

export async function addMember(projectId, { userId, email, role }) {
  return apiFetch(`/projects/${projectId}/members`, {
    method: "POST",
    body: { user_id: userId, email, role },
    auth: true,
  });
}

export async function reassignLeader(projectId, userId) {
  return apiFetch(`/projects/${projectId}/leader`, {
    method: "POST",
    body: { user_id: userId },
    auth: true,
  });
}

export async function createSection(projectId, { title, description, parentId, assigneeIds, durationHours }) {
  return apiFetch(`/projects/${projectId}/sections`, {
    method: "POST",
    body: {
      title,
      description,
      parent_id: parentId ?? null,
      assignee_ids: assigneeIds,
      duration_hours: durationHours,
    },
    auth: true,
  }); // -> { section: {...} }
}

export async function inviteMember(projectId, { userId, role }) {
  return apiFetch(`/projects/${projectId}/invitations`, {
    method: "POST",
    body: { user_id: userId, role },
    auth: true,
  });
}


export async function setMemberPermissions(projectId, { userId, canManageSections, canReviewWork }) {
  return apiFetch(`/projects/${projectId}/permissions`, {
    method: "POST",
    body: { user_id: userId, can_manage_sections: canManageSections, can_review_work: canReviewWork },
    auth: true,
  });
}


export async function discontinueProject(projectId) {
  return apiFetch(`/projects/${projectId}/discontinue`, { method: "POST", auth: true });
}


export async function reactivateProject(projectId) {
  return apiFetch(`/projects/${projectId}/reactivate`, { method: "POST", auth: true });
}

export async function listSectionsFlat(projectId) {
  return apiFetch(`/projects/${projectId}/sections/flat`, { auth: true });
}

