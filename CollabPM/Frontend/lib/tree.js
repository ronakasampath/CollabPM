// Pure, immutable helpers for the recursive box tree.
//
// The builder's state is an ARRAY of top-level nodes (a "forest"). Each node
// can contain its own array of child nodes, to any depth -- that self-reference
// is what makes the structure recursive.
//
// Every function here returns a BRAND-NEW array/objects instead of mutating the
// existing ones. This is the golden rule of React state: you never edit state
// in place, you replace it. React compares the new reference to the old one to
// decide what to re-render. Mutating in place would change the data without
// changing the reference, and the screen wouldn't update.

// Build one fresh, empty node with a unique id.
export function createNode(title = "Untitled section") {
  return {
    id: makeId(),
    title,
    description: "",
    assignees: [], // array -> supports one OR many members per box
    collapsed: false,
    children: [],
  };
}

function makeId() {
  // crypto.randomUUID exists in modern browsers and Node; fall back just in case.
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "id-" + Math.random().toString(36).slice(2);
}

// Walk the forest and replace the node matching `id` with patch(node),
// rebuilding only the branches on the path to it (everything else is reused).
function mapNode(nodes, id, patch) {
  return nodes.map((node) => {
    if (node.id === id) return patch(node);
    if (node.children.length) {
      return { ...node, children: mapNode(node.children, id, patch) };
    }
    return node;
  });
}

// Merge `changes` into the node with this id (e.g. {title: "New"} or {collapsed: true}).
export function updateNode(nodes, id, changes) {
  return mapNode(nodes, id, (node) => ({ ...node, ...changes }));
}

// Append a new empty child under `parentId`, and expand the parent so you see it.
export function addChild(nodes, parentId) {
  return mapNode(nodes, parentId, (node) => ({
    ...node,
    collapsed: false,
    children: [...node.children, createNode()],
  }));
}

// Remove the node with `id` wherever it lives in the tree.
export function removeNode(nodes, id) {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) =>
      node.children.length ? { ...node, children: removeNode(node.children, id) } : node
    );
}

// Move a node earlier/later among ITS siblings. delta is -1 (up) or +1 (down).
export function moveNode(nodes, id, delta) {
  const index = nodes.findIndex((n) => n.id === id);

  if (index !== -1) {
    const target = index + delta;
    if (target < 0 || target >= nodes.length) return nodes; // already at the edge
    const copy = [...nodes];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    return copy;
  }

  // Not a sibling at this level -> recurse into children.
  return nodes.map((node) =>
    node.children.length ? { ...node, children: moveNode(node.children, id, delta) } : node
  );
}

// --- template helpers ---

// A template is reusable STRUCTURE, so we drop per-project data (assignees).
export function stripAssignees(nodes) {
  return nodes.map((n) => ({
    ...n,
    assignees: [],
    children: stripAssignees(n.children),
  }));
}

// When loading a saved template, give every node a fresh id so a reused branch
// doesn't collide with anything already on screen.
export function reIdTree(nodes) {
  return nodes.map((n) => ({
    ...n,
    id: makeId(),
    children: reIdTree(n.children),
  }));
}
