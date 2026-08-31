"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProject, createSection, inviteMember, setMemberPermissions, discontinueProject, reactivateProject, listSectionsFlat } from "@/lib/projects";
import { setSectionStatus, assignSection, submitSectionForReview, reviewSection, editSection, deleteSection, setSectionSchedule } from "@/lib/sections";
import { listVotes, createVote, castBallot } from "@/lib/votes";
import { searchUsers } from "@/lib/users";
import { saveProjectAsTemplate } from "@/lib/templates";
import { reportProject, removeMember } from "@/lib/reports";
import Breadcrumbs from "@/components/Shell/Breadcrumbs";
import styles from "./ProjectWorkspace.module.css";

const STATUS = {
  done: { label: "Done", color: "#2f855a", bg: "#e6f4ec" },
  in_progress: { label: "In progress", color: "#b7791f", bg: "#fbf1dc" },
  not_started: { label: "Not started", color: "#718096", bg: "#edf1f5" },
  pending_review: { label: "Pending review", color: "#805ad5", bg: "#f1e8fb" },
};

const SCOPES = [
  { value: "all_members", label: "All project members" },
  { value: "main_section", label: "Everyone in this main section" },
  { value: "subsection", label: "Assignees of this subsection" },
];

export default function ProjectWorkspacePage() {
  return (
    <Suspense fallback={<main className={styles.wrap}><p>Loading...</p></main>}>
      <ProjectWorkspace />
    </Suspense>
  );
}

function ProjectWorkspace() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");

  const [me, setMe] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    getCurrentUser().then((d) => setMe(d.user)).catch(() => setMe(null)).finally(() => setAuthChecked(true));
  }, []);

  if (!authChecked) return <main className={styles.wrap}><p>Loading...</p></main>;
  if (!me) {
    return (
      <main className={styles.wrap}>
        <p>You need to be logged in to view this. <Link href="/login">Log in</Link></p>
      </main>
    );
  }
  if (!projectId) {
    return (
      <main className={styles.wrap}>
        <p>No project selected. <Link href="/home">Go to your dashboard</Link> to open or create one.</p>
      </main>
    );
  }
  return <ProjectDetail key={projectId} projectId={projectId} me={me} />;
}

/* ---------- detail ---------- */

function ProjectDetail({ projectId, me }) {
  const [project, setProject] = useState(null);
  const [votes, setVotes] = useState([]);
  const [error, setError] = useState("");
  const [voteFor, setVoteFor] = useState(null);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [assigningId, setAssigningId] = useState(null);
  const [addingChildId, setAddingChildId] = useState(null);
  const [addingChildBusy, setAddingChildBusy] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [permissionsFor, setPermissionsFor] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [confirmDiscontinue, setConfirmDiscontinue] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [schedulingFor, setSchedulingFor] = useState(null);
  const [allSections, setAllSections] = useState([]);
  const [reportingProject, setReportingProject] = useState(false);

  const refreshProject = useCallback(() => {
    return getProject(projectId).then((d) => setProject(d.project)).catch((e) => setError(e.message));
  }, [projectId]);
  const refreshVotes = useCallback(() => {
    return listVotes(projectId).then((d) => setVotes(d.votes)).catch((e) => setError(e.message));
  }, [projectId]);

  useEffect(() => { refreshProject(); refreshVotes(); }, [refreshProject, refreshVotes]);

  if (!project) {
    return (
      <main className={styles.wrap}>
        <Breadcrumbs items={[{ label: "Dashboard", href: "/home" }, { label: "Loading..." }]} />
        {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : <p>Loading...</p>}
      </main>
    );
  }

  const myMembership = project.members.find((m) => m.user_id === me.id);
  const isLeader = myMembership?.role === "leader";
  const isManager = isLeader || !!myMembership?.can_manage_sections;
  const isReviewer = isLeader || !!myMembership?.can_review_work;
  const isLocked = project.status === "discontinued" || project.status === "completed";

  async function handleSubmitForReview(sectionId) {
    try { await submitSectionForReview(sectionId); await refreshProject(); }
    catch (e) { setError(e.message); }
  }
  async function handleReview(sectionId, approve) {
    try { await reviewSection(sectionId, approve); await refreshProject(); }
    catch (e) { setError(e.message); }
  }
  async function handleAssign(sectionId, userIds) {
    try { await assignSection(sectionId, userIds); await refreshProject(); setAssigningId(null); }
    catch (e) { setError(e.message); }
  }
  async function handleAddSection(e) {
    e.preventDefault();
    if (!newSectionTitle.trim()) return;
    try { await createSection(projectId, { title: newSectionTitle }); setNewSectionTitle(""); await refreshProject(); }
    catch (e2) { setError(e2.message); }
  }
  async function handleAddSubsection(parentId, title) {
    setAddingChildBusy(true);
    try {
      await createSection(projectId, { title, parentId });
      await refreshProject();
    } catch (e) {
      setError(e.message);
    } finally {
      setAddingChildBusy(false);
      setAddingChildId(null);
    }
  }
  async function handleEditSection(sectionId, title, description) {
    try { await editSection(sectionId, { title, description }); await refreshProject(); setEditingId(null); }
    catch (e) { setError(e.message); }
  }
  async function handleDeleteSection(sectionId) {
    if (!window.confirm("Delete this section and everything under it? This can't be undone.")) return;
    setDeletingId(sectionId);
    try {
      await deleteSection(sectionId);
      await refreshProject();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeletingId(null);
    }
  }
  async function handleCallVote(payload) {
    try {
      await createVote(projectId, {
        section_id: voteFor?.id ?? null, title: payload.title, description: payload.description,
        scope: payload.scope, anonymous: payload.anonymous, options: payload.options, closes_at: payload.closesAt,
      });
      await refreshVotes(); setVoteFor(null);
    } catch (e) { setError(e.message); }
  }
  async function handleCastBallot(voteId, optionId) {
    try { await castBallot(voteId, optionId); await refreshVotes(); }
    catch (e) { setError(e.message); }
  }
  async function handleSavePermissions(userId, perms) {
    try {
      await setMemberPermissions(projectId, { userId, ...perms });
      await refreshProject();
      setPermissionsFor(null);
    } catch (e) { setError(e.message); }
  }
  async function handleDiscontinue() {
    try { await discontinueProject(projectId); await refreshProject(); setConfirmDiscontinue(false); }
    catch (e) { setError(e.message); }
  }
  async function handleReactivate() {
    try { await reactivateProject(projectId); await refreshProject(); }
    catch (e) { setError(e.message); }
  }
  async function handleSaveTemplate(name, description, isPublic, useGenericNames) {
    try {
      await saveProjectAsTemplate(projectId, { name, description, isPublic, useGenericNames });
      setSavingTemplate(false);
    } catch (e) { setError(e.message); }
  }
  async function handleSaveSchedule(sectionId, payload) {
    try {
      await setSectionSchedule(sectionId, payload);
      await refreshProject();
      setSchedulingFor(null);
    } catch (e) { setError(e.message); }
  }
  function handleOpenSchedule(node) {
    listSectionsFlat(projectId).then((d) => setAllSections(d.sections)).catch(() => setAllSections([]));
    setSchedulingFor(node);
  }
  async function handleReportProject(reason) {
    try {
      await reportProject(projectId, reason);
      setReportingProject(false);
      alert("Report submitted.");
    } catch (e) {
      setError(e.message);
    }
  }
  async function handleKickMember(userId) {
    if (!window.confirm("Remove this member from the project?")) return;
    try {
      await removeMember(projectId, userId);
      await refreshProject();
    } catch (e) {
      setError(e.message);
    }
  }

  const deadlines = collectDeadlines(project.sections);

  return (
    <main className={styles.wrap}>
      <Breadcrumbs items={[{ label: "Dashboard", href: "/home" }, { label: project.name }]} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <h1 className={styles.title}>
          {project.name}
          {project.status === "discontinued" && (
            <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 700, color: "var(--danger)", background: "#fdecec", padding: "3px 9px", borderRadius: 999, verticalAlign: "middle" }}>
              Discontinued
            </span>
          )}
          {project.status === "completed" && (
            <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 700, color: "#2f855a", background: "#e6f4ec", padding: "3px 9px", borderRadius: 999, verticalAlign: "middle" }}>
              Completed
            </span>
          )}
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          {isLeader && (
            <button className={styles.btn} onClick={() => setSavingTemplate(true)}>
              Save as template
            </button>
          )}
          {isLeader && project.status === "active" && (
            <button className={styles.btn} style={{ borderColor: "var(--danger)", color: "var(--danger)" }} onClick={() => setConfirmDiscontinue(true)}>
              Discontinue project
            </button>
          )}

          <button className={styles.btn} onClick={() => setReportingProject(true)}>Report project</button>

          {isLeader && project.status === "discontinued" && (
            <button className={styles.btn} onClick={handleReactivate}>
              Reactivate project
            </button>
          )}
        </div>
      </div>

      {error && (
        <p style={{ color: "var(--danger)", background: "#fdecec", border: "1px solid #f3c6c6", borderRadius: 6, padding: "8px 12px", fontSize: 13 }}>
          {error}
        </p>
      )}

      <div className={styles.layout}>
        <div>
          {project.sections.map((s) => (
            <SectionNode
              key={s.id} node={s} members={project.members} isLeader={isLeader}
              isManager={isManager && !isLocked} isReviewer={isReviewer && !isLocked} myId={me.id}
              assigningId={assigningId} onAssignStart={setAssigningId} onAssignSubmit={handleAssign}
              addingChildId={addingChildId} addingChildBusy={addingChildBusy}
              onAddChildStart={setAddingChildId} onAddChildSubmit={handleAddSubsection}
              editingId={editingId} onEditStart={setEditingId} onEditSubmit={handleEditSection}
              deletingId={deletingId} onDelete={handleDeleteSection}
              onSubmitForReview={isLocked ? undefined : handleSubmitForReview}
              onReview={handleReview} onCallVote={isLocked ? undefined : setVoteFor}
              onSchedule={isLocked ? undefined : handleOpenSchedule}
            />
          ))}
          {isManager && !isLocked && (
            <form onSubmit={handleAddSection} className={styles.node} style={{ display: "flex", gap: 8 }}>
              <input placeholder="New top-level section title" value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                style={{ flex: 1, padding: 8, border: "1px solid var(--border)", borderRadius: 6 }} />
              <button type="submit" className={styles.btnPrimary}>Add section</button>
            </form>
          )}
        </div>

        <aside className={styles.rail}>
          <div className={styles.railPanel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 className={styles.railTitle} style={{ margin: 0 }}>Members</h2>
              {isLeader && !isLocked && (
                <button className={styles.btn} onClick={() => setInviting((v) => !v)}>
                  {inviting ? "Close" : "Invite"}
                </button>
              )}
            </div>
            {project.members.map((m) => (
              <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Link href={`/users/${encodeURIComponent(m.username)}`} className={styles.member} style={{ flex: 1 }}>
                  <span className={styles.avatar}>{m.username.slice(0, 2).toUpperCase()}</span>
                  <span className={styles.memberName}>{m.username}</span>
                  {m.role === "leader" && <span className={styles.leaderTag}>lead</span>}
                  {(m.can_manage_sections || m.can_review_work) && (
                    <span className={styles.leaderTag} style={{ color: "#805ad5" }}>co-lead</span>
                  )}
                </Link>
                {isLeader && m.role !== "leader" && !isLocked && (
                  <button className={styles.btn} style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => setPermissionsFor(m)}>
                    Permissions
                  </button>
                )}
                {isLeader && m.role !== "leader" && !isLocked && (
                  <button className={styles.btn} style={{ color: "var(--danger)", fontSize: 11, padding: "2px 8px" }}
                    onClick={() => handleKickMember(m.user_id)}>
                    Remove
                  </button>
                )}
              </div>
            ))}
            {inviting && <InvitePanel projectId={projectId} onDone={() => setInviting(false)} />}
          </div>

          <div className={styles.railPanel}>
            <h2 className={styles.railTitle}>Votes</h2>
            {votes.length === 0 ? (
              <p className={styles.empty}>No votes yet.</p>
            ) : (
              votes.map((v) => <VoteCard key={v.id} vote={v} onCast={handleCastBallot} />)
            )}
          </div>

          <div className={styles.railPanel}>
            <h2 className={styles.railTitle}>Deadlines</h2>
            {deadlines.length === 0 ? (
              <p className={styles.empty}>No deadlines set yet.</p>
            ) : (
              deadlines.map((d) => (
                <div key={d.id} style={{ padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{d.path}</div>
                  <div style={{ fontSize: 12, color: d.overdue ? "var(--danger)" : "var(--muted)", fontWeight: d.overdue ? 600 : 400 }}>
                    {d.overdue ? "overdue" : "due " + d.deadline.toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      {voteFor && <CallVoteModal section={voteFor} onSubmit={handleCallVote} onClose={() => setVoteFor(null)} />}
      {permissionsFor && (
        <PermissionsModal member={permissionsFor} onSave={handleSavePermissions} onClose={() => setPermissionsFor(null)} />
      )}
      {confirmDiscontinue && (
        <div className={styles.backdrop} onClick={() => setConfirmDiscontinue(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className={styles.modalHead}>
              <h2 className={styles.modalTitle}>Discontinue this project?</h2>
              <button className={styles.close} onClick={() => setConfirmDiscontinue(false)} aria-label="Close">&times;</button>
            </div>
            <p style={{ fontSize: 14, color: "var(--muted)" }}>
              Members will still be able to view it, but assigning work, calling votes, and reviewing submissions will be disabled.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.btn} onClick={() => setConfirmDiscontinue(false)}>Cancel</button>
              <button className={styles.btnPrimary} style={{ background: "var(--danger)", borderColor: "var(--danger)" }} onClick={handleDiscontinue}>
                Discontinue
              </button>
            </div>
          </div>
        </div>
      )}
      {savingTemplate && (
        <SaveTemplateModal onSave={handleSaveTemplate} onClose={() => setSavingTemplate(false)} />
      )}
      {schedulingFor && (
        <ScheduleModal
          section={schedulingFor}
          allSections={allSections}
          onSave={(payload) => handleSaveSchedule(schedulingFor.id, payload)}
          onClose={() => setSchedulingFor(null)}
        />
      )}
      {reportingProject && (
        <ReportModal
          title="Report this project"
          onSubmit={handleReportProject}
          onClose={() => setReportingProject(false)}
        />
      )}
    </main>
  );
}

/* ---------- invite panel ---------- */

function InvitePanel({ projectId, onDone }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const handle = setTimeout(() => {
      searchUsers(query, projectId).then((d) => setResults(d.users)).catch((e) => setError(e.message));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, projectId]);

  async function send(user) {
    setError("");
    try {
      await inviteMember(projectId, { userId: user.id, role: "member" });
      setSent(user.id);
      setResults((prev) => prev.filter((u) => u.id !== user.id));
    } catch (e) {
      setError(e.message);
      setResults((prev) => prev.filter((u) => u.id !== user.id));
    }
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
      <input
        placeholder="Search by username or email"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ width: "100%", padding: 7, border: "1px solid var(--border)", borderRadius: 6, marginBottom: 8 }}
      />
      {error && <p style={{ color: "var(--danger)", fontSize: 12 }}>{error}</p>}
      {results.map((u) => (
        <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: 13 }}>
          <span>{u.username} <span style={{ color: "var(--muted)" }}>({u.email})</span></span>
          <button className={styles.btn} onClick={() => send(u)}>Invite</button>
        </div>
      ))}
      {sent && <p style={{ color: "var(--muted)", fontSize: 12 }}>Invitation sent.</p>}
      <button className={styles.btn} style={{ marginTop: 8 }} onClick={onDone}>Done</button>
    </div>
  );
}

/* ---------- permissions popup ---------- */

function PermissionsModal({ member, onSave, onClose }) {
  const [manage, setManage] = useState(!!member.can_manage_sections);
  const [review, setReview] = useState(!!member.can_review_work);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Permissions for {member.username}</h2>
          <button className={styles.close} onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={manage} onChange={(e) => setManage(e.target.checked)} />
          Create subsections and assign members
        </label>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={review} onChange={(e) => setReview(e.target.checked)} />
          Approve or reject submitted work
        </label>
        <div className={styles.modalActions}>
          <button className={styles.btn} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={() => onSave(member.user_id, { canManageSections: manage, canReviewWork: review })}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- save as template popup ---------- */

function SaveTemplateModal({ onSave, onClose }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [naming, setNaming] = useState("real");

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Save as template</h2>
          <button className={styles.close} onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <label className={styles.field}>
          <span>Template name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className={styles.field}>
          <span>Description</span>
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <div className={styles.field}>
          <span>Section names</span>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, marginTop: 6 }}>
            <input type="radio" name="naming" checked={naming === "real"} onChange={() => setNaming("real")} style={{ marginTop: 3 }} />
            <span>
              Keep the actual section names and descriptions
              <div style={{ color: "var(--muted)", fontSize: 12 }}>e.g. "Design", "Backend API"</div>
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, marginTop: 8 }}>
            <input type="radio" name="naming" checked={naming === "generic"} onChange={() => setNaming("generic")} style={{ marginTop: 3 }} />
            <span>
              Save structure only, with generic names
              <div style={{ color: "var(--muted)", fontSize: 12 }}>e.g. "Section 1", "Section 1.1", "Section 1.1.2"</div>
            </span>
          </label>
        </div>

        <label className={styles.checkRow}>
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          Make this template public (anyone can use it)
        </label>
        <div className={styles.modalActions}>
          <button className={styles.btn} onClick={onClose}>Cancel</button>
          <button
            className={styles.btnPrimary}
            disabled={!name.trim()}
            onClick={() => onSave(name.trim(), description, isPublic, naming === "generic")}
          >
            Save template
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- report popup ---------- */

function ReportModal({ title, onSubmit, onClose }) {
  const [reason, setReason] = useState("");
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>{title}</h2>
          <button className={styles.close} onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why you're reporting this..."
          style={{ width: "100%", padding: 8, border: "1px solid var(--border)", borderRadius: 6 }} />
        <div className={styles.modalActions}>
          <button className={styles.btn} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} disabled={!reason.trim()} onClick={() => onSubmit(reason.trim())}>
            Submit report
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- schedule popup ---------- */

function ScheduleModal({ section, allSections, onSave, onClose }) {
  const [mode, setMode] = useState(section.due_at ? "date" : "duration");
  const [dueAt, setDueAt] = useState(section.due_at ? toLocalInput(new Date(section.due_at)) : "");
  const [durationHours, setDurationHours] = useState(section.duration_hours ?? "");
  const [predecessorIds, setPredecessorIds] = useState(section.predecessor_ids || []);

  const options = allSections.filter((s) => s.id !== section.id);

  function toggle(id) {
    setPredecessorIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    if (mode === "date") {
      onSave({ predecessorIds, dueAt: dueAt ? new Date(dueAt).toISOString() : "", durationHours: "" });
    } else {
      onSave({ predecessorIds, dueAt: "", durationHours: durationHours === "" ? "" : Number(durationHours) });
    }
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Schedule &quot;{section.title}&quot;</h2>
          <button className={styles.close} onClick={onClose} aria-label="Close">&times;</button>
        </div>

        <div className={styles.field}>
          <span>Depends on (must finish first)</span>
          <div style={{ maxHeight: 140, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6, padding: 8, marginTop: 4 }}>
            {options.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>No other sections yet.</p>
            ) : (
              options.map((s) => (
                <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "3px 0" }}>
                  <input type="checkbox" checked={predecessorIds.includes(s.id)} onChange={() => toggle(s.id)} />
                  {s.title}
                </label>
              ))
            )}
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            Sections with no shared dependency run at the same time. Sections sharing a dependency all start once it's done.
          </p>
        </div>

        <div className={styles.field}>
          <span>Deadline</span>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 6 }}>
            <input type="radio" name="mode" checked={mode === "date"} onChange={() => setMode("date")} />
            Fixed date and time
          </label>
          {mode === "date" && (
            <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)}
              style={{ marginTop: 6, padding: 8, border: "1px solid var(--border)", borderRadius: 6 }} />
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 10 }}>
            <input type="radio" name="mode" checked={mode === "duration"} onChange={() => setMode("duration")} />
            Time limit after dependencies finish (or after assignment, if none)
          </label>
          {mode === "duration" && (
            <input type="number" min="1" placeholder="Hours" value={durationHours}
              onChange={(e) => setDurationHours(e.target.value)}
              style={{ marginTop: 6, padding: 8, border: "1px solid var(--border)", borderRadius: 6, width: 120 }} />
          )}
        </div>

        <div className={styles.modalActions}>
          <button className={styles.btn} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={submit}>Save</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- section tree ---------- */

function SectionNode({ node, members, isLeader, isManager, isReviewer, myId, assigningId, onAssignStart, onAssignSubmit,
  addingChildId, addingChildBusy, onAddChildStart, onAddChildSubmit,
  editingId, onEditStart, onEditSubmit, deletingId, onDelete,
  onSubmitForReview, onReview, onCallVote, onSchedule }) {
  const s = STATUS[node.status] || STATUS.not_started;
  const isLeaf = !node.children || node.children.length === 0;
  const assigning = assigningId === node.id;
  const addingChild = addingChildId === node.id;
  const editing = editingId === node.id;
  const isDeleting = deletingId === node.id;
  const [childTitle, setChildTitle] = useState("");

  const isAssignee = node.assignees.some((a) => a.user_id === myId);
  const canActOnThis = isAssignee;

  function submitChild() {
    if (!childTitle.trim() || addingChildBusy) return;
    onAddChildSubmit(node.id, childTitle.trim());
    setChildTitle("");
  }

  if (editing) {
    return (
      <SectionEditForm
        node={node}
        onSave={(title, description) => onEditSubmit(node.id, title, description)}
        onCancel={() => onEditStart(null)}
      />
    );
  }

  return (
    <div className={styles.node} style={isDeleting ? { opacity: 0.6 } : undefined}>
      <div className={styles.nodeTop}>
        <span className={styles.nodeTitle}>{node.title}</span>
        {node.assignees.length > 0 && (
          <span className={styles.assignees}>{node.assignees.map((a) => a.username).join(", ")}</span>
        )}
        <span className={styles.pill} style={{ background: s.bg, color: s.color }}>
          <span className={styles.dot} style={{ background: s.color }} />
          {s.label}
        </span>
        <div className={styles.nodeActions}>
          {isManager && (
            <button className={styles.btn} onClick={() => onAssignStart(assigning ? null : node.id)} disabled={isDeleting}>
              Assign
            </button>
          )}
          {isManager && (
            <button className={styles.btn} onClick={() => onAddChildStart(addingChild ? null : node.id)} disabled={isDeleting}>
              + Subsection
            </button>
          )}
          {isManager && onSchedule && (
            <button className={styles.btn} onClick={() => onSchedule(node)} disabled={isDeleting}>
              Schedule
            </button>
          )}
          {isManager && (
            <button className={styles.btn} onClick={() => onEditStart(node.id)} disabled={isDeleting}>Edit</button>
          )}
          {isManager && (
            <button className={styles.btn} style={{ color: "var(--danger)" }} onClick={() => onDelete(node.id)} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          )}

          {isLeaf && node.status !== "done" && node.status !== "pending_review" && isAssignee && (
            <button className={styles.btn} onClick={() => onSubmitForReview(node.id)} disabled={isDeleting}>
              Submit for review
            </button>
          )}

          {node.status === "pending_review" && isReviewer && (
            <>
              <button className={styles.btn} onClick={() => onReview(node.id, true)} disabled={isDeleting}>Approve</button>
              <button className={styles.btn} onClick={() => onReview(node.id, false)} disabled={isDeleting}>Reject</button>
            </>
          )}
          {node.status === "pending_review" && !isReviewer && (
            <span style={{ fontSize: 12, color: "var(--muted)", alignSelf: "center" }}>Awaiting leader review</span>
          )}

          {canActOnThis && onCallVote && (
            <button className={styles.btnPrimary} onClick={() => onCallVote(node)} disabled={isDeleting}>Call a vote</button>
          )}
        </div>
      </div>

      {isDeleting && <div className={styles.ghostBar} style={{ marginTop: 8 }} />}

      {node.description && (
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>{node.description}</p>
      )}

      {assigning && (
        <AssignRow members={members} current={node.assignees.map((a) => a.user_id)}
          onSubmit={(userIds) => onAssignSubmit(node.id, userIds)} onCancel={() => onAssignStart(null)} />
      )}

      {addingChild && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            autoFocus
            placeholder="Subsection title"
            value={childTitle}
            disabled={addingChildBusy}
            onChange={(e) => setChildTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitChild(); }}
            style={{ flex: 1, padding: 6, border: "1px solid var(--border)", borderRadius: 6 }}
          />
          <button className={styles.btnPrimary} onClick={submitChild} disabled={addingChildBusy}>
            {addingChildBusy ? "Adding..." : "Add"}
          </button>
          <button className={styles.btn} onClick={() => onAddChildStart(null)} disabled={addingChildBusy}>Cancel</button>
        </div>
      )}
      {addingChild && addingChildBusy && (
        <div className={styles.ghostNode} style={{ marginTop: 10 }}>
          Adding "{childTitle || "new subsection"}"...
          <div className={styles.ghostBar} />
        </div>
      )}

      {!isLeaf && (
        <div className={styles.children}>
          {node.children.map((c) => (
            <SectionNode key={c.id} node={c} members={members} isLeader={isLeader}
              isManager={isManager} isReviewer={isReviewer} myId={myId}
              assigningId={assigningId} onAssignStart={onAssignStart} onAssignSubmit={onAssignSubmit}
              addingChildId={addingChildId} addingChildBusy={addingChildBusy}
              onAddChildStart={onAddChildStart} onAddChildSubmit={onAddChildSubmit}
              editingId={editingId} onEditStart={onEditStart} onEditSubmit={onEditSubmit}
              deletingId={deletingId} onDelete={onDelete}
              onSubmitForReview={onSubmitForReview} onReview={onReview} onCallVote={onCallVote}
              onSchedule={onSchedule} />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionEditForm({ node, onSave, onCancel }) {
  const [title, setTitle] = useState(node.title);
  const [description, setDescription] = useState(node.description || "");
  return (
    <div className={styles.node}>
      <input value={title} onChange={(e) => setTitle(e.target.value)}
        style={{ width: "100%", padding: 8, border: "1px solid var(--border)", borderRadius: 6, marginBottom: 8, fontWeight: 600 }} />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
        placeholder="Description (optional)"
        style={{ width: "100%", padding: 8, border: "1px solid var(--border)", borderRadius: 6, marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <button className={styles.btnPrimary} onClick={() => onSave(title, description)} disabled={!title.trim()}>Save</button>
        <button className={styles.btn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function AssignRow({ members, current, onSubmit, onCancel }) {
  const [selected, setSelected] = useState(current);
  function toggle(userId) {
    setSelected((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]);
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 8, fontSize: 13 }}>
      {members.map((m) => (
        <label key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={selected.includes(m.user_id)} onChange={() => toggle(m.user_id)} />
          {m.username}
        </label>
      ))}
      <button className={styles.btnPrimary} onClick={() => onSubmit(selected)}>Save</button>
      <button className={styles.btn} onClick={onCancel}>Cancel</button>
    </div>
  );
}

function VoteCard({ vote, onCast }) {
  const closed = new Date(vote.closes_at).getTime() <= Date.now();
  return (
    <div className={styles.voteCard}>
      <h3 className={styles.voteTitle}>{vote.title}</h3>
      <p className={styles.voteMeta}>
        {vote.anonymous ? "anonymous" : "named"} &middot; {vote.total_votes} votes &middot;{" "}
        {closed ? <span className={styles.closed}>closed</span> : "open"}
      </p>
      {vote.options.map((o) => (
        <label key={o.id} className={styles.opt}>
          <input type="radio" name={`vote-${vote.id}`} disabled={closed || vote.you_voted}
            onChange={() => onCast(vote.id, o.id)} />
          <span>{o.text}</span>
          {o.link && <a className={styles.optLink} href={o.link} target="_blank" rel="noreferrer">link</a>}
          <span className={styles.optCount}>{o.count}</span>
        </label>
      ))}
    </div>
  );
}

function CallVoteModal({ section, onSubmit, onClose }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState("all_members");
  const [anonymous, setAnonymous] = useState(false);
  const [options, setOptions] = useState([{ text: "", image: "", link: "" }, { text: "", image: "", link: "" }]);
  const [closesAt, setClosesAt] = useState(() => toLocalInput(new Date(Date.now() + 2 * 86400 * 1000)));

  function setOption(i, key, value) { setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, [key]: value } : o))); }
  function addOption() { setOptions((prev) => [...prev, { text: "", image: "", link: "" }]); }
  function removeOption(i) { setOptions((prev) => prev.filter((_, idx) => idx !== i)); }

  function submit(e) {
    e.preventDefault();
    const clean = options.map((o) => ({ ...o, text: o.text.trim() })).filter((o) => o.text);
    if (!title.trim() || clean.length < 2) { alert("Give the vote a title and at least two options."); return; }
    onSubmit({ title: title.trim(), description, scope, anonymous, options: clean, closesAt: new Date(closesAt).toISOString() });
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Call a vote on &quot;{section.title}&quot;</h2>
          <button className={styles.close} onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <form onSubmit={submit}>
          <label className={styles.field}><span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
          <label className={styles.field}><span>Description</span>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          <label className={styles.field}><span>Who votes?</span>
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              {SCOPES.map((sc) => <option key={sc.value} value={sc.value}>{sc.label}</option>)}
            </select></label>
          <div className={styles.field}>
            <span>Options (text, image URL, link URL)</span>
            {options.map((o, i) => (
              <div key={i} className={styles.optionRow}>
                <input placeholder="Option text" value={o.text} onChange={(e) => setOption(i, "text", e.target.value)} />
                <input placeholder="Image URL" value={o.image} onChange={(e) => setOption(i, "image", e.target.value)} />
                <input placeholder="Link URL" value={o.link} onChange={(e) => setOption(i, "link", e.target.value)} />
                <button type="button" className={styles.rowBtn} onClick={() => removeOption(i)} aria-label="Remove option">&times;</button>
              </div>
            ))}
            <button type="button" className={styles.rowBtn} onClick={addOption}>+ Add option</button>
          </div>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            Anonymous votes
          </label>
          <label className={styles.field}><span>Closes at</span>
            <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} /></label>
          <div className={styles.modalActions}>
            <button type="button" className={styles.btn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}>Call vote</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function toLocalInput(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function collectDeadlines(nodes, path = []) {
  const out = [];
  for (const n of nodes || []) {
    const children = n.children || [];
    if (children.length === 0) {
      if (n.computed_deadline) {
        const deadline = new Date(n.computed_deadline);
        out.push({ id: n.id, title: n.title, path: path.join(" / "), deadline, overdue: deadline.getTime() <= Date.now() });
      }
    } else {
      out.push(...collectDeadlines(children, [...path, n.title]));
    }
  }
  return out.sort((a, b) => a.deadline - b.deadline);
}