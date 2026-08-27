"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  useProject,
  markSectionDone,
  callVote,
  castVote,
  votesForUser,
  CURRENT_USER,
} from "@/lib/projectStore";
import { humanDuration } from "@/lib/time";
import styles from "./ProjectWorkspace.module.css";

const STATUS = {
  done: { label: "Done", color: "#2f855a", bg: "#e6f4ec" },
  in_progress: { label: "In progress", color: "#b7791f", bg: "#fbf1dc" },
  not_started: { label: "Not started", color: "#718096", bg: "#edf1f5" },
};

const SCOPES = [
  { value: "all_members", label: "All project members" },
  { value: "main_section", label: "Everyone in this main section" },
  { value: "subsection", label: "Assignees of this subsection" },
];

export default function ProjectWorkspace() {
  const [projectId, setProjectId] = useState(null);
  const [now, setNow] = useState(null);
  // Which section a "call vote" modal is open for (a section object, or null).
  const [voteFor, setVoteFor] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setProjectId(params.get("project"));
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const project = useProject(projectId);

  return (
    <main className={styles.wrap}>
      <Link className={styles.back} href="/home">
        &larr; My dashboard
      </Link>
      <h1 className={styles.title}>{project.name}</h1>

      <div className={styles.layout}>
        {/* main: the section tree */}
        <div>
          {project.sections.map((s) => (
            <SectionNode
              key={s.id}
              node={s}
              projectId={project.id}
              onCallVote={setVoteFor}
            />
          ))}
        </div>

        {/* right rail: members + votes for you */}
        <aside className={styles.rail}>
          <div className={styles.railPanel}>
            <h2 className={styles.railTitle}>Members</h2>
            {project.members.map((m) => (
              <Link key={m} href={`/users/${encodeURIComponent(m)}`} className={styles.member}>
                <span className={styles.avatar}>{m.slice(0, 2).toUpperCase()}</span>
                <span className={styles.memberName}>{m}</span>
                {project.leader === m && <span className={styles.leaderTag}>lead</span>}
              </Link>
            ))}
          </div>

          <div className={styles.railPanel}>
            <h2 className={styles.railTitle}>Votes for you</h2>
            <VotesForYou project={project} now={now} />
          </div>
        </aside>
      </div>

      {voteFor && (
        <CallVoteModal
          projectId={project.id}
          section={voteFor}
          onClose={() => setVoteFor(null)}
        />
      )}
    </main>
  );
}

/* ---------- section tree (recursive) ---------- */

function SectionNode({ node, projectId, onCallVote }) {
  const s = STATUS[node.status] || STATUS.not_started;
  const isLeaf = !node.children || node.children.length === 0;
  return (
    <div className={styles.node}>
      <div className={styles.nodeTop}>
        <span className={styles.nodeTitle}>{node.title}</span>
        {node.assignees && node.assignees.length > 0 && (
          <span className={styles.assignees}>{node.assignees.join(", ")}</span>
        )}
        <span className={styles.pill} style={{ background: s.bg, color: s.color }}>
          <span className={styles.dot} style={{ background: s.color }} />
          {s.label}
        </span>
        <div className={styles.nodeActions}>
          {isLeaf && node.status !== "done" && (
            <button
              className={styles.btn}
              onClick={() => markSectionDone(projectId, node.id)}
            >
              Mark complete
            </button>
          )}
          <button className={styles.btnPrimary} onClick={() => onCallVote(node)}>
            Call a vote
          </button>
        </div>
      </div>

      {!isLeaf && (
        <div className={styles.children}>
          {node.children.map((c) => (
            <SectionNode
              key={c.id}
              node={c}
              projectId={projectId}
              onCallVote={onCallVote}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- right rail: votes for the current user ---------- */

function VotesForYou({ project, now }) {
  const votes = votesForUser(project, CURRENT_USER);
  if (votes.length === 0) {
    return <p className={styles.empty}>No votes need your attention.</p>;
  }
  return votes.map((v) => {
    const total = v.options.reduce((sum, o) => sum + o.votes, 0);
    const myBallot = v.ballots[CURRENT_USER];
    const closed = now != null && new Date(v.closesAt).getTime() - now <= 0;
    return (
      <div key={v.id} className={styles.voteCard}>
        <h3 className={styles.voteTitle}>{v.title}</h3>
        <p className={styles.voteMeta}>
          on &quot;{v.targetSection}&quot; &middot; by {v.calledBy} &middot;{" "}
          {v.anonymous ? "anonymous" : "named"} &middot;{" "}
          {closed ? (
            <span className={styles.closed}>closed</span>
          ) : now != null ? (
            "closes in " + humanDuration(new Date(v.closesAt).getTime() - now)
          ) : (
            ""
          )}
        </p>
        {v.options.map((o) => (
          <label key={o.id} className={styles.opt}>
            <input
              type="radio"
              name={`vote-${v.id}`}
              checked={myBallot === o.id}
              disabled={closed}
              onChange={() => castVote(project.id, v.id, o.id, CURRENT_USER)}
            />
            <span>{o.text}</span>
            {o.link && (
              <a className={styles.optLink} href={o.link} target="_blank" rel="noreferrer">
                link
              </a>
            )}
            <span className={styles.optCount}>{o.votes}</span>
          </label>
        ))}
      </div>
    );
  });
}

/* ---------- call-a-vote modal ---------- */

function CallVoteModal({ projectId, section, onClose }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState("all_members");
  const [anonymous, setAnonymous] = useState(false);
  const [options, setOptions] = useState([
    { text: "", image: "", link: "" },
    { text: "", image: "", link: "" },
  ]);
  // Default deadline: 2 days out. Computed on the client (modal is client-only).
  const [closesAt, setClosesAt] = useState(() =>
    toLocalInput(new Date(Date.now() + 2 * 86400 * 1000))
  );

  function setOption(i, key, value) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, [key]: value } : o)));
  }
  function addOption() {
    setOptions((prev) => [...prev, { text: "", image: "", link: "" }]);
  }
  function removeOption(i) {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function submit(e) {
    e.preventDefault();
    const clean = options.map((o) => ({ ...o, text: o.text.trim() })).filter((o) => o.text);
    if (!title.trim() || clean.length < 2) {
      alert("Give the vote a title and at least two options.");
      return;
    }
    callVote(projectId, section.id, {
      title: title.trim(),
      description,
      scope,
      anonymous,
      options: clean,
      closesAt: new Date(closesAt).toISOString(),
    });
    onClose();
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Call a vote on &quot;{section.title}&quot;</h2>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <form onSubmit={submit}>
          <label className={styles.field}>
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>

          <label className={styles.field}>
            <span>Description</span>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span>Who votes?</span>
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              {SCOPES.map((sc) => (
                <option key={sc.value} value={sc.value}>
                  {sc.label}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.field}>
            <span>Options (text, image URL, link URL)</span>
            {options.map((o, i) => (
              <div key={i} className={styles.optionRow}>
                <input
                  placeholder="Option text"
                  value={o.text}
                  onChange={(e) => setOption(i, "text", e.target.value)}
                />
                <input
                  placeholder="Image URL"
                  value={o.image}
                  onChange={(e) => setOption(i, "image", e.target.value)}
                />
                <input
                  placeholder="Link URL"
                  value={o.link}
                  onChange={(e) => setOption(i, "link", e.target.value)}
                />
                <button
                  type="button"
                  className={styles.rowBtn}
                  onClick={() => removeOption(i)}
                  aria-label="Remove option"
                >
                  &times;
                </button>
              </div>
            ))}
            <button type="button" className={styles.rowBtn} onClick={addOption}>
              + Add option
            </button>
          </div>

          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
            />
            Anonymous votes
          </label>

          <label className={styles.field}>
            <span>Closes at</span>
            <input
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </label>

          <div className={styles.modalActions}>
            <button type="button" className={styles.btn} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.btnPrimary}>
              Call vote
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Format a Date as the value a <input type="datetime-local"> expects.
function toLocalInput(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}
