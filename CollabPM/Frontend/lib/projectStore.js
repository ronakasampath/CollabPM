"use client";

import { useSyncExternalStore } from "react";
import { SAMPLE_PROJECTS, CURRENT_USER } from "@/lib/sampleProject";
import { sectionProgress, overallProgress } from "@/lib/progress";

// A tiny in-memory store that lives OUTSIDE React, at module scope. Every page
// reads from it and can mutate it (mark a task done, call a vote, cast a vote),
// and every subscribed component re-renders. This is the seam we'll later back
// with real API calls.

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2);
}

// Deep clone the sample, and make sure every seeded vote has the fields the
// voting logic expects (ballots/audience/scope), so old and new votes are alike.
function normalize(projects) {
  return projects.map((p) => ({
    ...p,
    votes: (p.votes || []).map((v) => ({
      scope: "all_members",
      audience: p.members,
      ballots: {},
      ...v,
    })),
  }));
}

let state = normalize(JSON.parse(JSON.stringify(SAMPLE_PROJECTS)));

const listeners = new Set();
function emit() {
  for (const l of listeners) l();
}
function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot() {
  return state;
}

// --- hooks ---

export function useProjects() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useProject(id) {
  const projects = useProjects();
  return projects.find((p) => p.id === id) || projects[0];
}

// --- section helpers ---

function findSection(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const found = findSection(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

// The top-level section (main section / phase) whose subtree contains `id`.
function topAncestorContaining(sections, id) {
  const inSubtree = (node) =>
    node.id === id || (node.children || []).some(inSubtree);
  return sections.find(inSubtree) || null;
}

// Union of every assignee inside a section's subtree.
function subtreeAssignees(node) {
  const set = new Set();
  const walk = (n) => {
    (n.assignees || []).forEach((a) => set.add(a));
    (n.children || []).forEach(walk);
  };
  walk(node);
  return [...set];
}

// --- mutations ---

export function markSectionDone(projectId, sectionId) {
  state = state.map((p) =>
    p.id !== projectId ? p : { ...p, sections: setDone(p.sections, sectionId) }
  );
  emit();
}

function setDone(nodes, id) {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, status: "done" };
    if (n.children && n.children.length) return { ...n, children: setDone(n.children, id) };
    return n;
  });
}

// Resolve who a vote goes to, given the scope and the section it targets.
export function audienceForScope(project, sectionId, scope) {
  if (scope === "subsection") {
    const s = findSection(project.sections, sectionId);
    return s ? subtreeAssignees(s) : project.members;
  }
  if (scope === "main_section") {
    const top = topAncestorContaining(project.sections, sectionId);
    return top ? subtreeAssignees(top) : project.members;
  }
  return project.members; // all_members
}

// Anyone can call a vote on a section. We resolve the audience now and store it.
export function callVote(projectId, sectionId, opts) {
  const { title, description, scope, options, anonymous, closesAt } = opts;
  const calledBy = opts.calledBy || CURRENT_USER;
  state = state.map((p) => {
    if (p.id !== projectId) return p;
    const section = findSection(p.sections, sectionId);
    const audience = audienceForScope(p, sectionId, scope);
    const vote = {
      id: makeId(),
      sectionId,
      targetSection: section ? section.title : "Project",
      title,
      description: description || "",
      calledBy,
      anonymous: !!anonymous,
      scope,
      audience,
      closesAt,
      ballots: {},
      options: (options || []).map((o) => ({
        id: makeId(),
        text: o.text,
        image: o.image || "",
        link: o.link || "",
        votes: 0,
      })),
    };
    return { ...p, votes: [vote, ...(p.votes || [])] };
  });
  emit();
}

// Cast (or change) one voter's ballot; keeps one-vote-per-person.
export function castVote(projectId, voteId, optionId, voter = CURRENT_USER) {
  state = state.map((p) => {
    if (p.id !== projectId) return p;
    return {
      ...p,
      votes: p.votes.map((v) => {
        if (v.id !== voteId) return v;
        const prev = v.ballots[voter];
        if (prev === optionId) return v;
        const options = v.options.map((o) => {
          let votes = o.votes;
          if (o.id === prev) votes -= 1;
          if (o.id === optionId) votes += 1;
          return { ...o, votes };
        });
        return { ...v, options, ballots: { ...v.ballots, [voter]: optionId } };
      }),
    };
  });
  emit();
}

// --- derived helpers (pure) ---

export function myTasks(project, user = CURRENT_USER) {
  const out = [];
  const walk = (nodes, path) => {
    for (const node of nodes) {
      const children = node.children || [];
      if (children.length === 0) {
        if ((node.assignees || []).includes(user)) {
          out.push({ ...node, path: path.join(" / "), projectId: project.id });
        }
      } else {
        walk(children, [...path, node.title]);
      }
    }
  };
  walk(project.sections, []);
  return out;
}

// Votes this user is invited to (their name is in the audience).
export function votesForUser(project, user = CURRENT_USER) {
  return (project.votes || []).filter((v) => (v.audience || []).includes(user));
}

export function projectProgress(project) {
  return overallProgress(project.sections);
}

export { sectionProgress, CURRENT_USER };
