// Build the notification feed for a user across ALL their projects: votes they
// are invited to, and deadlines on their unfinished tasks. Pure; sorted soonest
// first. Future kinds (mentions, assignment changes, ...) slot in here.

import { taskDeadline } from "@/lib/time";

export function buildNotifications(projects, user, now) {
  const items = [];

  for (const p of projects) {
    // Votes the user is invited to.
    for (const v of p.votes || []) {
      if (!(v.audience || []).includes(user)) continue;
      const closesMs = new Date(v.closesAt).getTime();
      const voted = !!(v.ballots && v.ballots[user]);
      const closed = now != null && closesMs - now <= 0;
      items.push({
        id: "vote-" + v.id,
        kind: "vote",
        projectId: p.id,
        projectName: p.name,
        title: v.title,
        when: closesMs,
        note: closed ? "closed" : voted ? "you voted" : "needs your vote",
        urgent: !closed && !voted,
      });
    }

    // Deadlines on the user's not-done leaf tasks.
    const walk = (nodes, path) => {
      for (const n of nodes) {
        const ch = n.children || [];
        if (ch.length === 0) {
          if ((n.assignees || []).includes(user) && n.status !== "done") {
            const dl = taskDeadline(n);
            if (dl != null) {
              items.push({
                id: "dl-" + p.id + "-" + n.id,
                kind: "deadline",
                projectId: p.id,
                projectName: p.name,
                title: n.title,
                path: path.join(" / "),
                when: dl,
                urgent: now != null && dl - now <= 0,
              });
            }
          }
        } else {
          walk(ch, [...path, n.title]);
        }
      }
    };
    walk(p.sections, []);
  }

  items.sort((a, b) => (a.when || Infinity) - (b.when || Infinity));
  return items;
}
