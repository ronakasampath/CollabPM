"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  useProjects,
  markSectionDone,
  myTasks,
  projectProgress,
  CURRENT_USER,
} from "@/lib/projectStore";
import { timeLeftInfo, soonestDeadline } from "@/lib/time";
import styles from "./UserDashboard.module.css";

const STATUS = {
  done: { label: "Done", color: "#2f855a", bg: "#e6f4ec" },
  in_progress: { label: "In progress", color: "#b7791f", bg: "#fbf1dc" },
  not_started: { label: "Not started", color: "#718096", bg: "#edf1f5" },
};

// The per-user home: a stat card per project the user is on, and a popup with
// their current work + mark-complete, driven by the shared store.
export default function UserDashboard() {
  const projects = useProjects();
  const [openId, setOpenId] = useState(null); // which project's popup is open

  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  // Only the projects this user belongs to.
  const mine = projects.filter((p) => p.members.includes(CURRENT_USER));
  const openProject = mine.find((p) => p.id === openId) || null;

  return (
    <main className={styles.wrap}>
      <h1 className={styles.heading}>Welcome, {CURRENT_USER}</h1>
      <p className={styles.sub}>Your projects and what needs doing.</p>

      <div className={styles.cards}>
        {mine.map((project) => {
          const tasks = myTasks(project, CURRENT_USER);
          const openTasks = tasks.filter((t) => t.status !== "done");
          const pct = Math.round(projectProgress(project));
          const due = soonestDeadline(tasks, now);
          const role = project.leader === CURRENT_USER ? "Leader" : "Member";
          return (
            <button
              key={project.id}
              className={styles.card}
              onClick={() => setOpenId(project.id)}
            >
              <div className={styles.cardTop}>
                <h2 className={styles.cardName}>{project.name}</h2>
                <span className={styles.role}>{role}</span>
              </div>
              <div className={styles.cardStats}>
                <div className={styles.stat}>
                  <span className={styles.statNum}>{openTasks.length}</span>
                  <span className={styles.statLabel}>my open tasks</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statNum}>{pct}%</span>
                  <span className={styles.statLabel}>project done</span>
                </div>
              </div>
              <div
                className={`${styles.timeleft} ${due.overdue ? styles.overdue : ""}`}
              >
                {due.none
                  ? "Your work here is done"
                  : due.label
                  ? `Soonest deadline: ${due.label}`
                  : " "}
              </div>
            </button>
          );
        })}
      </div>

      {openProject && (
        <WorkPopup
          project={openProject}
          now={now}
          onClose={() => setOpenId(null)}
        />
      )}
    </main>
  );
}

function WorkPopup({ project, now, onClose }) {
  // Read tasks fresh from the (already re-rendered) project each time.
  const tasks = myTasks(project, CURRENT_USER);

  // Close on Escape, for good measure.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      {/* stopPropagation so clicking inside the modal doesn't close it */}
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Your work: {project.name}</h2>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <p className={styles.modalSub}>
          {project.leader === CURRENT_USER ? "You lead this project." : `Led by ${project.leader}.`}
        </p>

        {tasks.length === 0 ? (
          <p className={styles.empty}>Nothing is assigned to you here.</p>
        ) : (
          tasks.map((t) => {
            const s = STATUS[t.status];
            const info = timeLeftInfo(t, now);
            return (
              <div key={t.id} className={styles.task}>
                <div>
                  <div className={styles.taskName}>{t.title}</div>
                  <div className={styles.taskPath}>{t.path}</div>
                </div>
                <div className={styles.taskRight}>
                  <span
                    className={styles.pill}
                    style={{ background: s.bg, color: s.color }}
                  >
                    <span className={styles.dot} style={{ background: s.color }} />
                    {s.label}
                  </span>
                  {t.status === "done" ? (
                    <span className={styles.doneTag}>{info.label || "done"}</span>
                  ) : (
                    <button
                      className={styles.completeBtn}
                      onClick={() => markSectionDone(project.id, t.id)}
                    >
                      Mark complete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        <div className={styles.modalActions}>
          <Link className={styles.viewBtn} href={`/project?project=${project.id}`}>
            Open project
          </Link>
          <Link
            className={styles.viewBtn}
            href={`/dashboard?project=${project.id}`}
          >
            View dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
