"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUser, logout } from "@/lib/auth";
import { listProjects, createProject } from "@/lib/projects";
import { listNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/notificationsApi";
import { listTemplates, applyTemplateToProject } from "@/lib/templates";
import Sidebar from "@/components/Shell/Sidebar";
import styles from "./AppChrome.module.css";

const BARE = new Set(["/", "/login", "/register", "/forgot-password", "/reset-password"]);

export default function AppChrome({ children }) {
  const pathname = usePathname();
  const bare = BARE.has(pathname);

  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  const [account, setAccount] = useState(null);
  const [projects, setProjects] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);

  const refreshNotifications = () => {
    listNotifications()
      .then((d) => { setNotifications(d.notifications); setUnread(d.unread); })
      .catch(() => {});
  };

  useEffect(() => {
    if (bare) return;
    getCurrentUser().then((d) => setAccount(d.user)).catch(() => setAccount(null));
    listProjects().then((d) => setProjects(d.projects)).catch(() => setProjects([]));
    refreshNotifications();
    const id = setInterval(refreshNotifications, 60000);
    return () => clearInterval(id);
  }, [bare]);

  useEffect(() => {
    if (bare) return;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bare]);

  useEffect(() => {
    if (bare) return;
    const openHandler = () => setNewProjectOpen(true);
    window.addEventListener("open-new-project", openHandler);
    return () => window.removeEventListener("open-new-project", openHandler);
  }, [bare]);

  // Bare routes (/, /login, /register, /forgot-password, /reset-password) get
  // NOTHING extra -- no header, no sidebar. This must stay a plain passthrough.
  if (bare) return <>{children}</>;

  const displayName = (account && account.username) || "...";

  async function handleOpenNotif(n) {
    if (!n.read) {
      try { await markNotificationRead(n.id); refreshNotifications(); } catch {}
    }
  }
  async function handleMarkAllRead() {
    try { await markAllNotificationsRead(); refreshNotifications(); } catch {}
  }

  return (
    <>
      <header className={styles.bar}>
        <Link className={styles.brand} href="/home">CollabPM</Link>

        <button className={styles.searchBtn} onClick={() => setSearchOpen(true)}>
          <span>Search projects and people...</span>
          <span className={styles.kbd}>Ctrl K</span>
        </button>

        <span className={styles.spacer} />

        <button className={styles.iconBtn} onClick={() => setNewProjectOpen(true)} aria-label="New project" title="New project">
          +
        </button>

        <button className={styles.iconBtn} onClick={() => setNotifOpen(true)} aria-label="Notifications">
          {"◉"}
          {unread > 0 && <span className={styles.badge}>{unread}</span>}
        </button>

        <div className={styles.accountWrap}>
          <button className={styles.avatarBtn} onClick={() => setMenuOpen((v) => !v)} aria-label="Account">
            {initials(displayName)}
          </button>
          {menuOpen && (
            <AccountMenu account={account} displayName={displayName} onClose={() => setMenuOpen(false)} />
          )}
        </div>
      </header>

      <div style={{ display: "flex", minHeight: "calc(100vh - 56px)" }}>
        <Sidebar />
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>

      {searchOpen && <SearchOverlay projects={projects} onClose={() => setSearchOpen(false)} />}
      {notifOpen && (
        <NotificationsDrawer
          notifications={notifications}
          onOpen={handleOpenNotif}
          onMarkAllRead={handleMarkAllRead}
          onClose={() => setNotifOpen(false)}
        />
      )}
      {newProjectOpen && <NewProjectModal onClose={() => setNewProjectOpen(false)} />}
    </>
  );
}

/* ---------- new project modal ---------- */

function NewProjectModal({ onClose }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listTemplates().then((d) => setTemplates(d.templates)).catch(() => setTemplates([]));
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const { project } = await createProject({ name, description });
      if (templateId) {
        await applyTemplateToProject(project.id, Number(templateId));
      }
      onClose();
      router.push(`/project?project=${project.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.searchBackdrop} onClick={onClose}>
      <div className={styles.searchPanel} onClick={(e) => e.stopPropagation()} style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>New project</h2>
          <button className={styles.close} onClick={onClose} aria-label="Close">&times;</button>
        </div>
        {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
        <form onSubmit={submit}>
          <label style={{ display: "block", marginBottom: 10, fontSize: 13, color: "var(--muted)" }}>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus
              style={{ display: "block", width: "100%", marginTop: 4, padding: 8, border: "1px solid var(--border)", borderRadius: 6, font: "inherit" }} />
          </label>
          <label style={{ display: "block", marginBottom: 10, fontSize: 13, color: "var(--muted)" }}>
            Description
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
              style={{ display: "block", width: "100%", marginTop: 4, padding: 8, border: "1px solid var(--border)", borderRadius: 6, font: "inherit" }} />
          </label>
          <label style={{ display: "block", marginBottom: 14, fontSize: 13, color: "var(--muted)" }}>
            Start from a template (optional)
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}
              style={{ display: "block", width: "100%", marginTop: 4, padding: 8, border: "1px solid var(--border)", borderRadius: 6, font: "inherit" }}>
              <option value="">Blank project</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.is_public ? " (public)" : ""}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={onClose} style={{ padding: "8px 14px", border: "1px solid var(--border)", borderRadius: 6, background: "#fff" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ padding: "8px 14px", border: "none", borderRadius: 6, background: "var(--accent)", color: "#fff", fontWeight: 600 }}>
              {saving ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- account dropdown ---------- */

function AccountMenu({ account, displayName, onClose }) {
  const router = useRouter();
  function doLogout() {
    logout();
    onClose();
    router.push("/login");
  }
  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 55 }} onClick={onClose} />
      <div className={styles.menu}>
        <div className={styles.menuHead}>
          <div className={styles.menuName}>{displayName}</div>
          {account && account.email && <div className={styles.menuEmail}>{account.email}</div>}
          {account && account.system_role && <span className={styles.role}>{account.system_role}</span>}
        </div>
        <Link className={styles.menuItem} href={`/users/${encodeURIComponent(displayName)}`} onClick={onClose}>
          View profile
        </Link>
        <Link className={styles.menuItem} href="/settings" onClick={onClose}>Account settings</Link>
        <div className={styles.menuSep} />
        <button className={styles.menuItem} onClick={doLogout}>Log out</button>
      </div>
    </>
  );
}

/* ---------- global search (real, scoped to projects + members) ---------- */

const FILTERS = [
  { key: "all", label: "All" },
  { key: "users", label: "Users" },
  { key: "projects", label: "Projects" },
];

function searchReal(projects, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return { users: [], projects: [] };
  const users = new Map();
  const projs = [];
  for (const p of projects) {
    if (p.name.toLowerCase().includes(q)) projs.push({ id: p.id, name: p.name });
    for (const m of p.members || []) {
      if (m.username.toLowerCase().includes(q)) users.set(m.username, { name: m.username });
    }
  }
  return { users: [...users.values()], projects: projs };
}

function SearchOverlay({ projects, onClose }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const results = searchReal(projects, query);
  const total = results.users.length + results.projects.length;

  function go(href) {
    onClose();
    router.push(href);
  }

  const show = (key) => filter === "all" || filter === key;

  return (
    <div className={styles.searchBackdrop} onClick={onClose}>
      <div className={styles.searchPanel} onClick={(e) => e.stopPropagation()}>
        <input
          className={styles.searchInput}
          autoFocus
          placeholder="Search projects and people..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
        />
        <div className={styles.filters}>
          {FILTERS.map((f) => (
            <button key={f.key} className={`${styles.chip} ${filter === f.key ? styles.chipActive : ""}`}
              onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className={styles.results}>
          {query.trim() === "" ? (
            <p className={styles.searchEmpty}>Type to search projects and people.</p>
          ) : total === 0 ? (
            <p className={styles.searchEmpty}>No matches for &quot;{query}&quot;.</p>
          ) : (
            <>
              {show("users") && results.users.length > 0 && (
                <Group title="Users">
                  {results.users.map((u) => (
                    <Row key={u.name} icon="U" main={u.name} sub="Member"
                      onClick={() => go(`/users/${encodeURIComponent(u.name)}`)} />
                  ))}
                </Group>
              )}
              {show("projects") && results.projects.length > 0 && (
                <Group title="Projects">
                  {results.projects.map((p) => (
                    <Row key={p.id} icon="P" main={p.name} sub="Project"
                      onClick={() => go(`/project?project=${p.id}`)} />
                  ))}
                </Group>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }) {
  return (
    <div className={styles.group}>
      <div className={styles.groupTitle}>{title}</div>
      {children}
    </div>
  );
}

function Row({ icon, main, sub, onClick }) {
  return (
    <button className={styles.result} onClick={onClick}>
      <span className={styles.resultIcon}>{icon}</span>
      <span>
        <span className={styles.resultMain}>{main}</span>
        {sub && <div className={styles.resultSub}>{sub}</div>}
      </span>
    </button>
  );
}

/* ---------- notifications drawer (real) ---------- */

function NotificationsDrawer({ notifications, onOpen, onMarkAllRead, onClose }) {
  return (
    <>
      <div className={styles.drawerBackdrop} onClick={onClose} />
      <aside className={styles.drawer}>
        <div className={styles.drawerHead}>
          <h2 className={styles.drawerTitle}>Notifications</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={onMarkAllRead}
              style={{ border: "none", background: "none", color: "var(--accent)", fontSize: 12, cursor: "pointer" }}
            >
              Mark all read
            </button>
            <button className={styles.close} onClick={onClose} aria-label="Close">&times;</button>
          </div>
        </div>
        <div className={styles.drawerBody}>
          {notifications.length === 0 ? (
            <p className={styles.searchEmpty}>You are all caught up.</p>
          ) : (
            notifications.map((n) => (
              <Link
                key={n.id}
                href={n.link || "/home"}
                className={styles.notif}
                style={{ opacity: n.read ? 0.55 : 1 }}
                onClick={() => { onOpen(n); onClose(); }}
              >
                <span className={styles.notifIcon} style={{ background: "#e8f0f8", color: "#2b6cb0" }}>
                  {n.type === "vote" ? "V" : n.type === "deadline" ? "D" : "N"}
                </span>
                <span>
                  <div className={styles.notifTitle}>{n.title}</div>
                  {n.body && <div className={styles.notifMeta}>{n.body}</div>}
                </span>
              </Link>
            ))
          )}
        </div>
      </aside>
    </>
  );
}

function initials(name) {
  return String(name).slice(0, 2).toUpperCase();
}