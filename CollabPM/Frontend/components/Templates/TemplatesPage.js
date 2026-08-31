"use client";

import { useEffect, useState, useCallback } from "react";
import { getCurrentUser } from "@/lib/auth";
import {
  listMyTemplates, listSharedTemplates, listExploreTemplates,
  adoptTemplate, shareTemplate, deleteTemplate, searchUsersForTemplate,
} from "@/lib/templates";
import styles from "./TemplatesPage.module.css";

const TABS = [
  { key: "mine", label: "My Templates" },
  { key: "explore", label: "Explore" },
];

export default function TemplatesPage() {
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState("mine");
  const [mine, setMine] = useState(null);
  const [shared, setShared] = useState(null);
  const [explore, setExplore] = useState(null);
  const [error, setError] = useState("");
  const [sharingFor, setSharingFor] = useState(null);

  useEffect(() => {
    getCurrentUser().then((d) => setMe(d.user)).catch(() => setMe(null));
  }, []);

  const refresh = useCallback(() => {
    listMyTemplates().then((d) => setMine(d.templates)).catch((e) => setError(e.message));
    listSharedTemplates().then((d) => setShared(d.templates)).catch(() => setShared([]));
    listExploreTemplates().then((d) => setExplore(d.templates)).catch((e) => setError(e.message));
  }, []);

  useEffect(refresh, [refresh]);

  async function handleAdopt(templateId) {
    try { await adoptTemplate(templateId); refresh(); }
    catch (e) { setError(e.message); }
  }

  async function handleDelete(templateId) {
    if (!window.confirm("Delete this template? This can't be undone.")) return;
    try { await deleteTemplate(templateId); refresh(); }
    catch (e) { setError(e.message); }
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px 80px" }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 26 }}>Templates</h1>
      <p style={{ color: "var(--muted)", margin: "0 0 20px" }}>
        Reusable project structures -- yours, shared with you, or public.
      </p>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 4px", marginBottom: -1, border: "none", background: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 600,
              color: tab === t.key ? "var(--accent)" : "var(--muted)",
              borderBottom: tab === t.key ? "2px solid var(--accent)" : "2px solid transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "mine" && (
        <>
          <h2 className={styles.sectionTitle}>My Templates</h2>
          <TemplateGrid
            templates={mine}
            emptyText="You haven't created any templates yet. Save a project as a template to see it here."
            renderActions={(t) => (
              <>
                {me && t.created_by === me.id && (
                  <>
                    <button className={styles.actionBtn} onClick={() => setSharingFor(t)}>Share</button>
                    <button className={styles.actionBtn} style={{ color: "var(--danger)" }} onClick={() => handleDelete(t.id)}>
                      Delete
                    </button>
                  </>
                )}
              </>
            )}
          />

          <h2 className={styles.sectionTitle} style={{ marginTop: 32 }}>Shared Templates</h2>
          <TemplateGrid
            templates={shared}
            emptyText="No one has shared a template with you yet."
          />
        </>
      )}

      {tab === "explore" && (
        <TemplateGrid
          templates={explore}
          emptyText="No public templates yet."
          renderActions={(t) => (
            <button className={styles.actionBtn} onClick={() => handleAdopt(t.id)}>
              Add to my templates
            </button>
          )}
        />
      )}

      {sharingFor && (
        <ShareTemplateModal template={sharingFor} onClose={() => setSharingFor(null)} />
      )}
    </main>
  );
}

function TemplateGrid({ templates, emptyText, renderActions }) {
  if (templates === null) return <p style={{ color: "var(--muted)" }}>Loading...</p>;
  if (templates.length === 0) return <p className={styles.empty}>{emptyText}</p>;
  return (
    <div className={styles.grid}>
      {templates.map((t) => (
        <div key={t.id} className={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>{t.name}</h3>
            {t.is_public && <span className={styles.publicTag}>Public</span>}
          </div>
          {t.description && <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>{t.description}</p>}
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
            {(t.structure || []).length} top-level section{(t.structure || []).length === 1 ? "" : "s"}
          </p>
          {renderActions && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>{renderActions(t)}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function ShareTemplateModal({ template, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState([]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const handle = setTimeout(() => {
      searchUsersForTemplate(template.id, query).then((d) => setResults(d.users)).catch((e) => setError(e.message));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, template.id]);

  async function send(user) {
    setError("");
    try {
      await shareTemplate(template.id, user.id);
      setSentTo((prev) => [...prev, user.id]);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Share &quot;{template.name}&quot;</h2>
          <button onClick={onClose} style={{ border: "none", background: "var(--bg)", borderRadius: 6, width: 28, height: 28 }}>&times;</button>
        </div>
        <input
          placeholder="Search by username or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: "100%", padding: 8, border: "1px solid var(--border)", borderRadius: 6, marginBottom: 10 }}
        />
        {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
        {results.map((u) => (
          <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", fontSize: 13 }}>
            <span>{u.username} <span style={{ color: "var(--muted)" }}>({u.email})</span></span>
            {sentTo.includes(u.id) ? (
              <span style={{ color: "var(--muted)" }}>Shared</span>
            ) : (
              <button className={styles.actionBtn} onClick={() => send(u)}>Share</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}