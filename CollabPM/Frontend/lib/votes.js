import { apiFetch } from "@/lib/api";

export async function listVotes(projectId) {
  return apiFetch(`/projects/${projectId}/votes`, { auth: true }); // -> { votes: [...] }
}

export async function createVote(projectId, data) {
  return apiFetch(`/projects/${projectId}/votes`, {
    method: "POST",
    body: data,
    auth: true,
  }); // -> { vote: {...} }
}

export async function castBallot(voteId, optionId) {
  return apiFetch(`/votes/${voteId}/ballot`, {
    method: "POST",
    body: { option_id: optionId },
    auth: true,
  });
}


export async function listMyVotes() {
  return apiFetch("/votes/mine", { auth: true });
}