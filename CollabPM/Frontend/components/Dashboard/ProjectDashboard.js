"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { overallProgress, sectionProgress, leafCounts } from "@/lib/progress";
import { getCurrentUser } from "@/lib/auth";
import { getProject } from "@/lib/projects";
import { listVotes, castBallot } from "@/lib/votes";
import styles from "./ProjectDashboard.module.css";

const STATUS = {
  done: { label: "Done", color: "#2f855a", bg: "#e6f4ec" },
  in_progress: { label: "In progress", color: "#b7791f", bg: "#fbf1dc" },
  not_started: { label: "Not started", color: "#718096", bg: "#edf1f5" },
  pending_review: { label: "Pending review", color: "#805ad5", bg: "#f1e8fb" },
};

export default function ProjectDashboardPage() {
  return (
    <Suspense fallback={<main className={styles.wrap}><p>Loading...</p></main>}>
      <ProjectDashboard />
    </Suspense>
  );
}

function ProjectDashboard() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");

  const [me, setMe] = useState(null);
  const [project, setProject] = useState(null);
  const [votes, setVotes] = useState([]);
  const [error, setError] = useState("");
  const [now, setNow] = useState(null);

  useEffect(() => {
    getCurrentUser().then((d) => setMe(d.user)).catch(() => setMe(null));
  }, []);

  const refresh = useCallback(() => {
    if (!projectId) return;
    getProject(projectId).then((d) => setProject(d.project)).catch((e) => setError(e.message));
    listVotes(projectId).then((d) => setVotes(d.votes)).catch((e) => setError(e.message));
  }, [projectId]);

  useEffect(() => {
    refresh();
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, [refresh]);

  if (!projectId) {
    return (
      <main className={styles.wrap}>
        <p>
          No project selected. <Link href="/project">Choose a project</Link>.
        </p>
      </main>
    );
  }
  if (error) {
    return (
      <main className={styles.wrap}>
        <Breadcrumbs items={[{ label: "Dashboard", href: "/home" }, { label: "Projects", href: "/project" }, { label: project.name }]} />
        <p style={{ color: "var(--danger)" }}>{error}</p>
      </main>
    );
  }
  if (!project || !me) {
    return <main className={styles.wrap}><p>Loading...</p></main>;
  }

  const overall = overallProgress(project.sections);
  const { total, done } = leafCounts(project.sections);
  const mine = myLeafTasks(project.sections, me.id);
  const leader = project.members.find((m) => m.role === "leader");

  async function handleCast(voteId, optionId) {
    try {
      await castBallot(voteId, optionId);
      const d = await listVotes(projectId);
      setVotes(d.votes);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className={styles.wrap}>
      <Link className={styles.back} href="/home">&larr; My dashboard</Link>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{project.name}</h1>
          <p className={styles.leaderline}>
            Leader: {leader ? leader.username : "unassigned"} &middot; {project.members.length} members
          </p>
        </div>
        <div className={styles.members}>
          {project.members.map((m) => (
            <span key={m.user_id} className={styles.avatar} title={m.username}>
              {initials(m.username)}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.grid}>
        {/* Overall progress */}
        <section className={`${styles.panel} ${styles.progressPanel}`}>
          <ProgressRing percent={overall} />
          <div className={styles.stats}>
            <span className={styles.statBig}>
              <strong>{Math.round(overall)}%</strong> complete
            </span>
            <span className={styles.statMuted}>
              {done} of {total} tasks done
            </span>
            <span className={styles.statMuted}>{project.sections.length} phases</span>
          </div>
        </section>

        {/* Phase breakdown */}
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Phases</h2>
          {project.sections.length === 0 ? (
            <p className={styles.empty}>No sections yet.</p>
          ) : (
            project.sections.map((s) => {
              const pct = Math.round(sectionProgress(s));
              return (
                <div key={s.id} className={styles.taskRow}>
                  <span className={styles.taskName}>{s.title}</span>
                  <StatusPill status={statusFromPercent(pct)} />
                  <div className={styles.meter}>
                    <div className={styles.meterFill} style={{ width: `${pct}%`, background: barColor(pct) }} />
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* My assigned work */}
        <section className={`${styles.panel} ${styles.panelWide}`}>
          <h2 className={styles.panelTitle}>My work ({me.username})</h2>
          {mine.length === 0 ? (
            <p className={styles.empty}>Nothing assigned to you here.</p>
          ) : (
            mine.map((t) => {
              const deadline = t.started_at && t.duration_hours
                ? new Date(t.started_at).getTime() + t.duration_hours * 3600 * 1000
                : null;
              const overdue = now != null && deadline != null && deadline - now <= 0;
              return (
                <div key={t.id} className={styles.taskRow}>
                  <div>
                    <div className={styles.taskName}>{t.title}</div>
                    <div className={styles.taskPath}>{t.path}</div>
                  </div>
                  <div className={styles.rowRight}>
                    <StatusPill status={t.status} />
                    {deadline != null && now != null && (
                      <span className={`${styles.timeleft} ${overdue ? styles.overdue : ""}`}>
                        {overdue ? "overdue" : humanDuration(deadline - now) + " left"}
                      </span>
                    )}
                  </div>
                  <div className={styles.meter}>
                    <div
                      className={styles.meterFill}
                      style={{ width: `${visualPercent(t.status)}%`, background: STATUS[t.status]?.color }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Votes */}
        <section className={`${styles.panel} ${styles.panelWide}`}>
          <h2 className={styles.panelTitle}>Votes</h2>
          {votes.length === 0 ? (
            <p className={styles.empty}>No votes yet.</p>
          ) : (
            votes.map((v) => <VoteCard key={v.id} vote={v} now={now} onCast={handleCast} />)
          )}
        </section>
      </div>
    </main>
  );
}

/* ---------- sub-components ---------- */

function ProgressRing({ percent }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - percent / 100);
  return (
    <svg className={styles.ring} width="128" height="128" viewBox="0 0 128 128">
      <circle cx="64" cy="64" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
      <circle
        cx="64" cy="64" r={r} fill="none" stroke="#2b6cb0" strokeWidth="12" strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 64 64)"
      />
      <text x="64" y="64" textAnchor="middle" dominantBaseline="central" className={styles.ringLabel}>
        {Math.round(percent)}%
      </text>
    </svg>
  );
}

function StatusPill({ status }) {
  const s = STATUS[status] || STATUS.not_started;
  return (
    <span className={styles.pill} style={{ background: s.bg, color: s.color }}>
      <span className={styles.dot} style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

function VoteCard({ vote, now, onCast }) {
  const maxCount = Math.max(...vote.options.map((o) => o.count), 0);
  const closed = now != null && new Date(vote.closes_at).getTime() - now <= 0;
  return (
    <div className={styles.vote}>
      <div className={styles.voteHead}>
        <h3 className={styles.voteTitle}>{vote.title}</h3>
        <span className={`${styles.closing} ${closed ? styles.overdue : ""}`}>
          {now == null ? "" : closingLabel(vote.closes_at, now)}
        </span>
      </div>
      <p className={styles.voteMeta}>
        {vote.anonymous ? "anonymous" : "named"} &middot; {vote.total_votes} votes
      </p>
      {vote.options.map((o) => {
        const share = vote.total_votes ? Math.round((o.count / vote.total_votes) * 100) : 0;
        const leading = o.count === maxCount && maxCount > 0;
        return (
          <div key={o.id} className={styles.option}>
            <div className={styles.optionTop}>
              <span>
                {o.text}
                {leading ? " (leading)" : ""}
              </span>
              <span className={styles.statMuted}>{o.count} &middot; {share}%</span>
            </div>
            <div className={styles.optionBar}>
              <div
                className={leading ? styles.optionFillLead : styles.optionFillDim}
                style={{ width: `${share}%`, height: "100%", borderRadius: 4 }}
              />
            </div>
            {!closed && !vote.you_voted && (
              <button
                onClick={() => onCast(vote.id, o.id)}
                style={{ marginTop: 4, fontSize: 12, border: "1px solid var(--border)", borderRadius: 6, padding: "2px 8px", background: "#fff" }}
              >
                Vote
              </button>
            )}
          </div>
        );
      })}
      {vote.you_voted && <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0" }}>You voted</p>}
    </div>
  );
}

/* ---------- helpers ---------- */

function initials(name) {
  return name.slice(0, 2).toUpperCase();
}

function statusFromPercent(pct) {
  if (pct >= 100) return "done";
  if (pct > 0) return "in_progress";
  return "not_started";
}

function barColor(pct) {
  if (pct >= 100) return STATUS.done.color;
  if (pct > 0) return "#2b6cb0";
  return "#cbd5e0";
}

function visualPercent(status) {
  if (status === "done") return 100;
  if (status === "pending_review") return 90;
  if (status === "in_progress") return 50;
  return 6;
}

function closingLabel(closesAt, now) {
  const ms = new Date(closesAt).getTime() - now;
  if (ms <= 0) return "closed";
  return "closes in " + humanDuration(ms);
}

function humanDuration(ms) {
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

// Walk the real section tree, collecting leaf sections assigned to this user.
function myLeafTasks(nodes, userId, path = []) {
  const out = [];
  for (const n of nodes || []) {
    const children = n.children || [];
    if (children.length === 0) {
      if ((n.assignees || []).some((a) => a.user_id === userId)) {
        out.push({ ...n, path: path.join(" / ") });
      }
    } else {
      out.push(...myLeafTasks(children, userId, [...path, n.title]));
    }
  }
  return out;
}