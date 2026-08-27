// Small time helpers shared by both dashboards. Kept UI-free so any component
// can use them.

export function humanDuration(ms) {
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

// A leaf's personal deadline = when its clock started + its duration.
export function taskDeadline(task) {
  if (!task.startedAt || !task.durationHours) return null;
  return new Date(task.startedAt).getTime() + task.durationHours * 3600 * 1000;
}

// { label, overdue } for a single task, given "now" (ms). Returns empty label
// until `now` is known (i.e. before mount, to avoid hydration mismatch).
export function timeLeftInfo(task, now) {
  if (now == null) return { label: "", overdue: false };
  if (task.status === "done") return { label: "done", overdue: false };
  const deadline = taskDeadline(task);
  if (deadline == null) return { label: "", overdue: false };
  const ms = deadline - now;
  if (ms <= 0) return { label: "overdue", overdue: true };
  return { label: humanDuration(ms) + " left", overdue: false };
}

// The soonest deadline among a set of not-yet-done tasks -> a card's "time left".
export function soonestDeadline(tasks, now) {
  const pending = tasks.filter((t) => t.status !== "done").map(taskDeadline).filter((d) => d != null);
  if (pending.length === 0) return { label: "all done", overdue: false, none: true };
  const soonest = Math.min(...pending);
  if (now == null) return { label: "", overdue: false };
  const ms = soonest - now;
  if (ms <= 0) return { label: "overdue", overdue: true };
  return { label: humanDuration(ms) + " left", overdue: false };
}
