// The progress-scoring scheme (v1, configurable later).
//
// Every top-level section gets an equal share of 100%. A section's own progress
// is the equal-weighted average of its children's progress, recursively. A leaf
// (a box with no subsections) is either done (100) or not (0). So finishing a
// deeply-nested leaf moves the needle by exactly its slice of the whole.
//
// These are PURE functions of the section tree, so we can run the identical
// logic on the server later and get the same number.

export function sectionProgress(node) {
  const children = node.children || [];
  if (children.length === 0) {
    // Leaf: full credit only when marked done.
    return node.status === "done" ? 100 : 0;
  }
  // Parent: equal-weighted average of its children.
  const total = children.reduce((sum, child) => sum + sectionProgress(child), 0);
  return total / children.length;
}

export function overallProgress(nodes) {
  if (!nodes || nodes.length === 0) return 0;
  const total = nodes.reduce((sum, node) => sum + sectionProgress(node), 0);
  return total / nodes.length;
}

// Count leaves and how many are done, for a "12 of 30 tasks" style readout.
export function leafCounts(nodes) {
  let total = 0;
  let done = 0;
  const walk = (node) => {
    const children = node.children || [];
    if (children.length === 0) {
      total += 1;
      if (node.status === "done") done += 1;
    } else {
      children.forEach(walk);
    }
  };
  (nodes || []).forEach(walk);
  return { total, done };
}
