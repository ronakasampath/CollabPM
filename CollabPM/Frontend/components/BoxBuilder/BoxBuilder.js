"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@/components/Box/Box";
import {
  createNode,
  addChild,
  updateNode,
  removeNode,
  moveNode,
  stripAssignees,
  reIdTree,
} from "@/lib/tree";
import styles from "./BoxBuilder.module.css";

const STORAGE_KEY = "collabpm_template";

// The BoxBuilder OWNS the whole tree in one piece of state (`nodes`). Every box
// on screen is a dumb renderer of part of this state; all edits funnel back
// here through the handlers, which call the pure tree helpers to produce a new
// tree, then setNodes(...) to re-render. One source of truth, many views of it.
export default function BoxBuilder() {
  const [nodes, setNodes] = useState([]);
  const [savedAt, setSavedAt] = useState(null);

  // Seed a small example ONCE, after the component mounts in the browser.
  // We do this in useEffect (not in useState's initial value) because the ids
  // are random: if they were generated during server rendering AND again in the
  // browser, the two wouldn't match and React would warn about a mismatch.
  useEffect(() => {
    setNodes([
      {
        ...createNode("Auth module"),
        description: "Everything needed for user login.",
        children: [
          { ...createNode("Gather requirements"), assignees: ["Ronak"] },
          {
            ...createNode("Build tables + backend"),
            assignees: ["Ronak", "Sam"],
          },
        ],
      },
    ]);
  }, []);

  function handleAddTopLevel() {
    setNodes((prev) => [...prev, createNode("New section")]);
  }
  function handleUpdate(id, changes) {
    setNodes((prev) => updateNode(prev, id, changes));
  }
  function handleAddChild(id) {
    setNodes((prev) => addChild(prev, id));
  }
  function handleRemove(id) {
    setNodes((prev) => removeNode(prev, id));
  }
  function handleMove(id, delta) {
    setNodes((prev) => moveNode(prev, id, delta));
  }

  function handleSaveTemplate() {
    // localStorage stores strings, so we JSON.stringify the (assignee-free) tree.
    const template = stripAssignees(nodes);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(template));
    setSavedAt(new Date().toLocaleTimeString());
  }
  function handleLoadTemplate() {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    // Fresh ids so a loaded template can't clash with what's already here.
    setNodes(reIdTree(JSON.parse(raw)));
  }
  function handleClear() {
    setNodes([]);
  }

  return (
    <main className={styles.wrap}>
      <Link className={styles.back} href="/">
        &larr; Home
      </Link>

      <header className={styles.header}>
        <h1>Work breakdown</h1>
        <div className={styles.toolbar}>
          <button onClick={handleAddTopLevel}>Add section</button>
          <button onClick={handleSaveTemplate} disabled={!nodes.length}>
            Save as template
          </button>
          <button onClick={handleLoadTemplate}>Load template</button>
          <button onClick={handleClear} disabled={!nodes.length}>
            Clear
          </button>
        </div>
        {savedAt && <p className={styles.saved}>Template saved at {savedAt}</p>}
      </header>

      {nodes.length === 0 ? (
        <p className={styles.empty}>
          No sections yet. Click &quot;Add section&quot; to start breaking down
          the work.
        </p>
      ) : (
        <div className={styles.list}>
          {nodes.map((node, i) => (
            <Box
              key={node.id}
              node={node}
              depth={0}
              index={i}
              siblingCount={nodes.length}
              onUpdate={handleUpdate}
              onAddChild={handleAddChild}
              onRemove={handleRemove}
              onMove={handleMove}
            />
          ))}
        </div>
      )}
    </main>
  );
}
