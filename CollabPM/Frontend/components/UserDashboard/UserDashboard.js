"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listProjects } from "@/lib/projects";
import { listNotifications, markNotificationRead } from "@/lib/notificationsApi";
import { listMyInvitations, acceptInvitation, declineInvitation } from "@/lib/invitations";
import styles from "./UserDashboard.module.css";

export default function UserDashboard() {
  const [me, setMe] = useState(null);
  const [projects, setProjects] = useState(null);
  const [notifications, setNotifications] = useState(null);
  const [invitations, setInvitations] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getCurrentUser().then((d) => setMe(d.user)).catch(() => setMe(null));
  }, []);

  const refreshAll = useCallback(() => {
    listProjects().then((d) => setProjects(d.projects)).catch((e) => setError(e.message));
    listNotifications().then((d) => setNotifications(d.notifications)).catch(() => setNotifications([]));
    listMyInvitations().then((d) => setInvitations(d.invitations)).catch(() => setInvitations([]));
  }, []);

  useEffect(refreshAll, [refreshAll]);

  async function handleAccept(id) {
    try { await acceptInvitation(id); refreshAll(); } catch (e) { setError(e.message); }
  }
  async function handleDecline(id) {
    try { await declineInvitation(id); refreshAll(); } catch (e) { setError(e.message); }
  }
  async function handleReadNotif(id) {
    try { await markNotificationRead(id); } catch {}
  }

  const displayName = me ? me.username : "...";

  return (
    <main className={styles.wrap} style={{ maxWidth: 1180 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
        {/* main column */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 className={styles.heading}>Welcome, {displayName}</h1>
              <p className={styles.sub}>Your projects and what needs doing.</p>
            </div>
            <Link href="/project" style={{
              padding: "9px 16px", border: "1px solid var(--accent)", borderRadius: "var(--radius)",
              color: "var(--accent)", textDecoration: "none", fontWeight: 600, fontSize: 14, whiteSpace: "nowrap",
            }}>
              View all projects
            </Link>
          </div>

          {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

          {projects === null ? (
  <>
    <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--muted)", margin: "24px 0 12px" }}>
      Ongoing projects
    </h2>
    <p className={styles.sub}>Loading...</p>
  </>
) : projects.length === 0 ? (
  <div
    style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: "80px 24px", minHeight: 320,
    }}
  >
    <h2 style={{ fontSize: 18, margin: "0 0 8px", color: "var(--text)" }}>No projects yet</h2>
    <p style={{ margin: "0 0 16px", color: "var(--muted)", maxWidth: 320 }}>
      Create your first project to start breaking down work with your team.
    </p>
    <button
      onClick={() => window.dispatchEvent(new Event("open-new-project"))}
      style={{
        padding: "9px 18px", border: "none", borderRadius: "var(--radius)",
        background: "var(--accent)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14,
      }}
    >
      Create a project
    </button>
  </div>
) : (
  <>
    <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--muted)", margin: "24px 0 12px" }}>
      Ongoing projects
    </h2>
    <div className={styles.cards}>
      {projects.map((p) => {
        const membership = (p.members || []).find((m) => m.user_id === (me && me.id));
        const role = membership && membership.role === "leader" ? "Leader" : "Member";
        return (
          <Link
            key={p.id}
            href={`/project?project=${p.id}`}
            className={styles.card}
            style={{ display: "block", textDecoration: "none", color: "inherit" }}
          >
            <div className={styles.cardTop}>
              <h2 className={styles.cardName}>{p.name}</h2>
              <span className={styles.role}>{role}</span>
              {p.status === "discontinued" && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--danger)", background: "#fdecec", padding: "2px 8px", borderRadius: 999 }}>
                  Discontinued
                </span>
              )}
              {p.status === "completed" && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#2f855a", background: "#e6f4ec", padding: "2px 8px", borderRadius: 999 }}>
                  Completed
                </span>
              )}
            </div>
            <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 13 }}>
              {(p.members || []).length} member{(p.members || []).length === 1 ? "" : "s"}
            </p>
            <p style={{ margin: "12px 0 0", color: "var(--muted)", fontSize: 12, fontStyle: "italic" }}>
              Stats coming soon
            </p>
          </Link>
        );
      })}
    </div>
  </>
)}
        </div>

        {/* right rail — persistent, Facebook-style */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 16 }}>
         <div className={styles.card} style={{ cursor: "default" }}>
  <h2 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
    Invitations
  </h2>
  {invitations === null ? (
    <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>Loading...</p>
  ) : invitations.length === 0 ? (
    <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>No pending invitations.</p>
  ) : (
    invitations.map((inv) => (
      <div key={inv.id} style={{ padding: "8px 0", borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: 13 }}>
          <strong>{inv.inviter_username}</strong> invited you to <strong>{inv.project_name}</strong> as {inv.role}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button onClick={() => handleAccept(inv.id)}
            style={{ padding: "4px 10px", border: "none", borderRadius: 6, background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600 }}>
            Accept
          </button>
          <button onClick={() => handleDecline(inv.id)}
            style={{ padding: "4px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "#fff", fontSize: 12 }}>
            Decline
          </button>
        </div>
      </div>
    ))
  )}
</div>

          <div className={styles.card} style={{ cursor: "default" }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
              Notifications
            </h2>
            {notifications === null ? (
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>Loading...</p>
            ) : notifications.length === 0 ? (
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>You are all caught up.</p>
            ) : (
              notifications.map((n) => (
                <Link key={n.id} href={n.link || "/home"} onClick={() => handleReadNotif(n.id)}
                  style={{
                    display: "block", padding: "8px 0", borderTop: "1px solid var(--border)",
                    textDecoration: "none", color: "inherit", opacity: n.read ? 0.55 : 1,
                  }}>
                  <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600 }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{n.body}</div>}
                </Link>
              ))
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}