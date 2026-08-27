// Global search across everything, by name. Pure function of the projects list
// plus a query. Returns results grouped by type so the UI can show sections
// (Users / Projects / Sections / Votes) and filter to one type.

export function searchAll(projects, query) {
  const q = (query || "").trim().toLowerCase();
  const empty = { users: [], projects: [], sections: [], votes: [] };
  if (!q) return empty;

  const users = new Map(); // name -> result (dedupe across projects)
  const projs = [];
  const sections = [];
  const votes = [];

  for (const p of projects) {
    if (p.name.toLowerCase().includes(q)) {
      projs.push({ id: p.id, name: p.name });
    }
    for (const m of p.members) {
      if (m.toLowerCase().includes(q)) users.set(m, { name: m });
    }
    const walk = (nodes, path) => {
      for (const n of nodes) {
        if (n.title.toLowerCase().includes(q)) {
          sections.push({
            id: n.id,
            title: n.title,
            projectId: p.id,
            projectName: p.name,
            path: path.join(" / "),
          });
        }
        walk(n.children || [], [...path, n.title]);
      }
    };
    walk(p.sections, []);
    for (const v of p.votes || []) {
      if (v.title.toLowerCase().includes(q)) {
        votes.push({ id: v.id, title: v.title, projectId: p.id, projectName: p.name });
      }
    }
  }

  return { users: [...users.values()], projects: projs, sections, votes };
}

// Total count across all groups, for "N results".
export function countResults(r) {
  return r.users.length + r.projects.length + r.sections.length + r.votes.length;
}
