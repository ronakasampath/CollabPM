import { apiFetch } from "@/lib/api";

export async function listTemplates() {
  return apiFetch("/templates", { auth: true });
}

export async function getTemplate(templateId) {
  return apiFetch(`/templates/${templateId}`, { auth: true });
}

export async function deleteTemplate(templateId) {
  return apiFetch(`/templates/${templateId}`, { method: "DELETE", auth: true });
}

export async function saveProjectAsTemplate(projectId, { name, description, isPublic, useGenericNames }) {
  return apiFetch(`/projects/${projectId}/save-as-template`, {
    method: "POST",
    body: {
      name,
      description,
      is_public: isPublic,
      use_generic_names: useGenericNames,
    },
    auth: true,
  });
}
export async function applyTemplateToProject(projectId, templateId) {
  return apiFetch(`/projects/${projectId}/apply-template`, {
    method: "POST",
    body: { template_id: templateId },
    auth: true,
  });
}

export async function listMyTemplates() {
  return apiFetch("/templates/mine", { auth: true });
}
export async function listSharedTemplates() {
  return apiFetch("/templates/shared", { auth: true });
}
export async function listExploreTemplates() {
  return apiFetch("/templates/explore", { auth: true });
}
export async function adoptTemplate(templateId) {
  return apiFetch(`/templates/${templateId}/adopt`, { method: "POST", auth: true });
}
export async function shareTemplate(templateId, userId) {
  return apiFetch(`/templates/${templateId}/share`, {
    method: "POST",
    body: { user_id: userId },
    auth: true,
  });
}
export async function searchUsersForTemplate(templateId, query) {
  return apiFetch(`/templates/${templateId}/user-search?q=${encodeURIComponent(query)}`, { auth: true });
}