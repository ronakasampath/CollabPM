"use client";

import { useState } from "react";
import styles from "./Box.module.css";

// A single box in the work-breakdown tree. It is RECURSIVE: to draw its
// children, it renders <Box> again for each child. That's what lets one small
// component represent a tree of unlimited depth.
//
// The box owns only tiny bits of LOCAL ui state (is the assign input open?).
// The real data (title, description, assignees, children) lives up in the
// BoxBuilder's state and is passed down via the `node` prop. When something
// changes, we don't edit `node` directly -- we call the callbacks
// (onUpdate/onAddChild/...) that were passed down, and the BoxBuilder produces
// a new tree. Data flows DOWN as props; changes flow UP as callback calls.
export default function Box({
  node,
  depth,
  index,
  siblingCount,
  onUpdate,
  onAddChild,
  onRemove,
  onMove,
}) {
  const [assigning, setAssigning] = useState(false);
  const [assigneeInput, setAssigneeInput] = useState("");

  function addAssignee() {
    const name = assigneeInput.trim();
    if (!name || node.assignees.includes(name)) {
      setAssigneeInput("");
      return;
    }
    // Add to the existing list -> a box can have MANY assignees (or just one).
    onUpdate(node.id, { assignees: [...node.assignees, name] });
    setAssigneeInput("");
  }

  function removeAssignee(name) {
    onUpdate(node.id, {
      assignees: node.assignees.filter((a) => a !== name),
    });
  }

  const hasChildren = node.children.length > 0;

  return (
    <div className={styles.box}>
      <div className={styles.topRow}>
        {/* Collapse/expand toggle -- only meaningful when there are children. */}
        <button
          className={styles.caret}
          aria-label={node.collapsed ? "Expand" : "Collapse"}
          onClick={() => onUpdate(node.id, { collapsed: !node.collapsed })}
          disabled={!hasChildren}
        >
          {hasChildren ? (node.collapsed ? ">" : "v") : "-"}
        </button>

        {/* Inline-editable title. */}
        <input
          className={styles.title}
          value={node.title}
          onChange={(e) => onUpdate(node.id, { title: e.target.value })}
        />

        {/* The stable id, shown so you can see each box has its own identity
            (used later to link boxes and save templates). */}
        <span className={styles.id} title="This box's id">
          {shortId(node.id)}
        </span>

        <div className={styles.rowControls}>
          <button
            onClick={() => onMove(node.id, -1)}
            disabled={index === 0}
            aria-label="Move up"
          >
            ^
          </button>
          <button
            onClick={() => onMove(node.id, +1)}
            disabled={index === siblingCount - 1}
            aria-label="Move down"
          >
            v
          </button>
          <button onClick={() => onRemove(node.id)} aria-label="Delete section">
            x
          </button>
        </div>
      </div>

      {/* Everything below the title is hidden when the box is collapsed. */}
      {!node.collapsed && (
        <>
          <textarea
            className={styles.description}
            placeholder="Describe this piece of work..."
            value={node.description}
            onChange={(e) => onUpdate(node.id, { description: e.target.value })}
          />

          {node.assignees.length > 0 && (
            <div className={styles.assignees}>
              {node.assignees.map((name) => (
                <span key={name} className={styles.chip}>
                  {name}
                  <button
                    className={styles.chipRemove}
                    onClick={() => removeAssignee(name)}
                    aria-label={`Remove ${name}`}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          )}

          {assigning && (
            <div className={styles.assignRow}>
              <input
                value={assigneeInput}
                onChange={(e) => setAssigneeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addAssignee();
                }}
                placeholder="Type a member name, press Enter"
                autoFocus
              />
              <button onClick={addAssignee}>Add</button>
              <button onClick={() => setAssigning(false)}>Done</button>
            </div>
          )}

          {/* The two spec'd buttons, centered at the bottom of the box. */}
          <div className={styles.actions}>
            <button
              className={styles.actionBtn}
              onClick={() => setAssigning((v) => !v)}
            >
              Assign
            </button>
            <button
              className={styles.actionBtn}
              onClick={() => onAddChild(node.id)}
            >
              Add subsection
            </button>
          </div>

          {/* The recursion: each child is another Box. */}
          {hasChildren && (
            <div className={styles.children}>
              {node.children.map((child, i) => (
                <Box
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  index={i}
                  siblingCount={node.children.length}
                  onUpdate={onUpdate}
                  onAddChild={onAddChild}
                  onRemove={onRemove}
                  onMove={onMove}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function shortId(id) {
  return String(id).slice(0, 4);
}
