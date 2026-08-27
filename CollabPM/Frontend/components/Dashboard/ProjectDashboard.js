"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { overallProgress, sectionProgress, leafCounts } from "@/lib/progress";
import { useProject, markSectionDone, myTasks, CURRENT_USER } from "@/lib/projectStore";
import { timeLeftInfo, humanDuration } from "@/lib/time";
import styles from "./ProjectDashboard.module.css";

const STATUS = {
  done: { label: "Done", color: "#2f855a", bg: "#e6f4ec" },
  in_progress: { label: "In progress", color: "#b7791f", bg: "#fbf1dc" },
  not_started: { label: "Not started", color: "#718096", bg: "#edf1f5" },
};

export default function ProjectDashboard() {
  // Which project? Read ?project=<id> from the URL on the client (avoids the
  // Suspense requirement that next/navigation's useSearchParams imposes).
  const [projectId, setProjectId] = useState(null);
  const [now, setNow] = useState(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setProjectId(params.get("project"));
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  // Reads from the shared store and re-renders whenever a task is marked done.
  const project = useProject(projectId);

  const overall = overallProgress(project.sections);
  const { total, done } = leafCounts(project.sections);
  const mine = myTasks(project, CURRENT_USER);

  return (
    <main className={styles.wrap}>
      <Link className={styles.back} href="/home">
        &larr; My dashboard
      </Link>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{project.name}</h1>
          <p className={styles.leaderline}>
            Leader: {project.leader} &middot; {project.members.length} members
          </p>
        </div>
        <div className={styles.members}>
          {project.members.map((m) => (
            <span key={m} className={styles.avatar} title={m}>
              {initials(m)}
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
          {project.sections.map((s) => {
            const pct = Math.round(sectionProgress(s));
            return (
              <div key={s.id} className={styles.taskRow}>
                <span className={styles.taskName}>{s.title}</span>
                <StatusPill status={statusFromPercent(pct)} />
                <div className={styles.meter}>
                  <div
                    className={styles.meterFill}
                    style={{ width: `${pct}%`, background: barColor(pct) }}
                  />
                </div>
              </div>
            );
          })}
        </section>

        {/* My assigned work -- with a Mark complete button per task */}
        <section className={`${styles.panel} ${styles.panelWide}`}>
          <h2 className={styles.panelTitle}>My work ({CURRENT_USER})</h2>
          {mine.length === 0 ? (
            <p className={styles.empty}>Nothing assigned to you here.</p>
          ) : (
            mine.map((t) => (
              <div key={t.id} className={styles.taskRow}>
                <div>
                  <div className={styles.taskName}>{t.title}</div>
                  <div className={styles.taskPath}>{t.path}</div>
                </div>
                <div className={styles.rowRight}>
                  <StatusPill status={t.status} />
                  <span
                    className={`${styles.timeleft} ${
                      timeLeftInfo(t, now).overdue ? styles.overdue : ""
                    }`}
                  >
                    {timeLeftInfo(t, now).label}
                  </span>
                  {t.status !== "done" && (
                    <button
                      className={styles.completeBtn}
                      onClick={() => markSectionDone(project.id, t.id)}
                    >
                      Mark complete
                    </button>
                  )}
                </div>
                <div className={styles.meter}>
                  <div
                    className={styles.meterFill}
                    style={{
                      width: `${visualPercent(t.status)}%`,
                      background: STATUS[t.status].color,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </section>

        {/* Open votes */}
        <section className={`${styles.panel} ${styles.panelWide}`}>
          <h2 className={styles.panelTitle}>Open votes</h2>
          {(project.votes || []).length === 0 ? (
            <p className={styles.empty}>No open votes.</p>
          ) : (
            project.votes.map((v) => <VoteCard key={v.id} vote={v} now={now} />)
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
        cx="64"
        cy="64"
        r={r}
        fill="none"
        stroke="#2b6cb0"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 64 64)"
      />
      <text
        x="64"
        y="64"
        textAnchor="middle"
        dominantBaseline="central"
        className={styles.ringLabel}
      >
        {Math.round(percent)}%
      </text>
    </svg>
  );
}

function StatusPill({ status }) {
  const s = STATUS[status];
  return (
    <span className={styles.pill} style={{ background: s.bg, color: s.color }}>
      <span className={styles.dot} style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

function VoteCard({ vote, now }) {
  const totalVotes = vote.options.reduce((sum, o) => sum + o.votes, 0);
  const maxVotes = Math.max(...vote.options.map((o) => o.votes));
  const closing = closingInfo(vote.closesAt, now);
  return (
    <div className={styles.vote}>
      <div className={styles.voteHead}>
        <h3 className={styles.voteTitle}>{vote.title}</h3>
        <span className={`${styles.closing} ${closing.closed ? styles.overdue : ""}`}>
          {closing.label}
        </span>
      </div>
      <p className={styles.voteMeta}>
        Called by {vote.calledBy} &middot; on &quot;{vote.targetSection}&quot; &middot;{" "}
        {vote.anonymous ? "anonymous" : "named"} &middot; {totalVotes} votes
      </p>
      {vote.options.map((o) => {
        const share = totalVotes ? Math.round((o.votes / totalVotes) * 100) : 0;
        const leading = o.votes === maxVotes && maxVotes > 0;
        return (
          <div key={o.id} className={styles.option}>
            <div className={styles.optionTop}>
              <span>
                {o.text}
                {leading ? " (leading)" : ""}
              </span>
              <span className={styles.statMuted}>
                {o.votes} &middot; {share}%
              </span>
            </div>
            <div className={styles.optionBar}>
              <div
                className={leading ? styles.optionFillLead : styles.optionFillDim}
                style={{ width: `${share}%`, height: "100%", borderRadius: 4 }}
              />
            </div>
          </div>
        );
      })}
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
  if (status === "in_progress") return 50;
  return 6;
}

function closingInfo(closesAt, now) {
  if (now == null) return { label: "", closed: false };
  const ms = new Date(closesAt).getTime() - now;
  if (ms <= 0) return { label: "closed", closed: true };
  return { label: "closes in " + humanDuration(ms), closed: false };
}
