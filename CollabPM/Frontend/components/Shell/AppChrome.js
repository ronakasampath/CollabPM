"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useProjects, CURRENT_USER } from "@/lib/projectStore";
import { searchAll, countResults } from "@/lib/search";
import { buildNotifications } from "@/lib/notifications";
import { humanDuration } from "@/lib/time";
import { getCurrentUser, logout } from "@/lib/auth";
import styles from "./AppChrome.module.css";

// Routes that should NOT get the app chrome (marketing + auth).
const BARE = new Set(["/", "/login", "/register"]);

export default function AppChrome({ children }) {
  const pathname = usePathname();
  const bare = BARE.has(pathname);

  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [account, setAccount] = useState(null); // real logged-in user from /auth/me
  const [now, setNow] = useState(null);

  useEffect(() => {
    if (bare) return;
    getCurrentUser()
      .then((d) => setAccount(d.user))
      .catch(() => setAccount(null));
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, [bare]);

  // Cmd/Ctrl+K opens search.
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

  const projects = useProjects();
  const notifications = buildNotifications(projects, CURRENT_USER, now);
  const urgentCount = notifications.filter((n) => n.urgent).length;

  if (bare) return <>{children}</>;

  const displayName = (account && account.username) || CURRENT_USER;

  return (
    <>
      <header className={styles.bar}>
        <Link className={styles.brand} href="/home">
          CollabPM
        </Link>

        <button className={styles.searchBtn} onClick={() => setSearchOpen(true)}>
          <span>Search projects, sections, votes, people...</span>
          <span className={styles.kbd}>Ctrl K</span>
        </button>

        <span className={styles.spacer} />

        <button
          className={styles.iconBtn}
          onClick={() => setNotifOpen(true)}
          aria-label="Notifications"
        >
          {"◉"}
          {urgentCount > 0 && <span className={styles.badge}>{urgentCount}</span>}
        </button>

        <div className={styles.accountWrap}>
          <button
            className={styles.avatarBtn}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Account"
          >
            {initials(displayName)}
          </button>
          {menuOpen && (
            <AccountMenu
              account={account}
              displayName={displayName}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>
      </header>

      {children}

      {searchOpen && <SearchOverlay projects={projects} onClose={() => setSearchOpen(false)} />}
      {notifOpen && (
        <NotificationsDrawer
          notifications={notifications}
          now={now}
          onClose={() => setNotifOpen(false)}
        />
      )}
    </>
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
      {/* invisible backdrop closes the menu on outside click */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 55 }}
        onClick={onClose}
      />
      <div className={styles.menu}>
        <div className={styles.menuHead}>
          <div className={styles.menuName}>{displayName}</div>
          {account && account.email && <div className={styles.menuEmail}>{account.email}</div>}
          {account && account.system_role && (
            <span className={styles.role}>{account.system_role}</span>
          )}
        </div>
        <Link
          className={styles.menuItem}
          href={`/users/${encodeURIComponent(displayName)}`}
          onClick={onClose}
        >
          View profile
        </Link>
        <Link className={styles.menuItem} href="/settings" onClick={onClose}>
          Account settings
        </Link>
        <div className={styles.menuSep} />
        <button className={styles.menuItem} onClick={doLogout}>
          Log out
        </button>
      </div>
    </>
  );
}

/* ---------- global search ---------- */

const FILTERS = [
  { key: "all", label: "All" },
  { key: "users", label: "Users" },
  { key: "projects", label: "Projects" },
  { key: "sections", label: "Sections" },
  { key: "votes", label: "Votes" },
];

function SearchOverlay({ projects, onClose }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const results = searchAll(projects, query);
  const total = countResults(results);

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
          placeholder="Search everything by name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
        />
        <div className={styles.filters}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`${styles.chip} ${filter === f.key ? styles.chipActive : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className={styles.results}>
          {query.trim() === "" ? (
            <p className={styles.searchEmpty}>Type to search projects, sections, votes and people.</p>
          ) : total === 0 ? (
            <p className={styles.searchEmpty}>No matches for &quot;{query}&quot;.</p>
          ) : (
            <>
              {show("users") && results.users.length > 0 && (
                <Group title="Users">
                  {results.users.map((u) => (
                    <Row
                      key={u.name}
                      icon="U"
                      main={u.name}
                      sub="Member"
                      onClick={() => go(`/users/${encodeURIComponent(u.name)}`)}
                    />
                  ))}
                </Group>
              )}
              {show("projects") && results.projects.length > 0 && (
                <Group title="Projects">
                  {results.projects.map((p) => (
                    <Row
                      key={p.id}
                      icon="P"
                      main={p.name}
                      sub="Project"
                      onClick={() => go(`/project?project=${p.id}`)}
                    />
                  ))}
                </Group>
              )}
              {show("sections") && results.sections.length > 0 && (
                <Group title="Sections">
                  {results.sections.map((s) => (
                    <Row
                      key={s.projectId + s.id}
                      icon="S"
                      main={s.title}
                      sub={`${s.projectName}${s.path ? " / " + s.path : ""}`}
                      onClick={() => go(`/project?project=${s.projectId}`)}
                    />
                  ))}
                </Group>
              )}
              {show("votes") && results.votes.length > 0 && (
                <Group title="Votes">
                  {results.votes.map((v) => (
                    <Row
                      key={v.projectId + v.id}
                      icon="V"
                      main={v.title}
                      sub={v.projectName}
                      onClick={() => go(`/project?project=${v.projectId}`)}
                    />
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

/* ---------- notifications drawer ---------- */

function NotificationsDrawer({ notifications, now, onClose }) {
  return (
    <>
      <div className={styles.drawerBackdrop} onClick={onClose} />
      <aside className={styles.drawer}>
        <div className={styles.drawerHead}>
          <h2 className={styles.drawerTitle}>Notifications</h2>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className={styles.drawerBody}>
          {notifications.length === 0 ? (
            <p className={styles.searchEmpty}>You are all caught up.</p>
          ) : (
            notifications.map((n) => (
              <Link
                key={n.id}
                href={`/project?project=${n.projectId}`}
                className={styles.notif}
                onClick={onClose}
              >
                <span
                  className={styles.notifIcon}
                  style={{
                    background: n.kind === "vote" ? "#e8f0f8" : "#fbf1dc",
                    color: n.kind === "vote" ? "#2b6cb0" : "#b7791f",
                  }}
                >
                  {n.kind === "vote" ? "V" : "D"}
                </span>
                <span>
                  <div className={styles.notifTitle}>{n.title}</div>
                  <div className={styles.notifMeta}>
                    {n.projectName} · {n.kind === "vote" ? n.note : "deadline"}
                  </div>
                  <div className={`${styles.notifMeta} ${n.urgent ? styles.urgent : ""}`}>
                    {n.kind === "vote" ? closesLabel(n.when, now) : whenLabel(n.when, now)}
                  </div>
                </span>
              </Link>
            ))
          )}
        </div>
      </aside>
    </>
  );
}

/* ---------- helpers ---------- */

function initials(name) {
  return String(name).slice(0, 2).toUpperCase();
}

function whenLabel(when, now) {
  if (now == null || when == null) return "";
  const ms = when - now;
  if (ms <= 0) return "overdue";
  return "due in " + humanDuration(ms);
}

function closesLabel(when, now) {
  if (now == null) return "";
  const ms = when - now;
  if (ms <= 0) return "closed";
  return "closes in " + humanDuration(ms);
}
