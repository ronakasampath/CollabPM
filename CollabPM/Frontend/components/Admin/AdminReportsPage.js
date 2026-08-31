"use client";

import { useEffect, useState, useCallback } from "react";
import { listReports, dismissReport, suspendProjectByReport, banUserByReport } from "@/lib/reports";

export default function AdminReportsPage() {
  const [reports, setReports] = useState(null);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    listReports("open").then((d) => setReports(d.reports)).catch((e) => setError(e.message));
  }, []);
  useEffect(refresh, [refresh]);

  async function act(fn, reportId) {
    try { await fn(reportId); refresh(); } catch (e) { setError(e.message); }
  }

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "28px 24px 80px" }}>
      <h1 style={{ margin: "0 0 20px", fontSize: 26 }}>Reports</h1>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {reports === null ? (
        <p style={{ color: "var(--muted)" }}>Loading...</p>
      ) : reports.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No open reports.</p>
      ) : (
        reports.map((r) => (
          <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", padding: 16, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              {r.target_type === "project" ? `Project: ${r.target_project_name}` : `User: ${r.target_username}`}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 8px" }}>
              Reported by {r.reporter_username} &middot; {new Date(r.created_at).toLocaleString()}
            </div>
            <p style={{ fontSize: 14, margin: "0 0 12px" }}>{r.reason}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => act(dismissReport, r.id)}
                style={{ padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "#fff", fontSize: 13 }}>
                Dismiss
              </button>
              {r.target_type === "project" && (
                <button onClick={() => act(suspendProjectByReport, r.id)}
                  style={{ padding: "6px 12px", border: "none", borderRadius: 6, background: "var(--danger)", color: "#fff", fontSize: 13, fontWeight: 600 }}>
                  Suspend project
                </button>
              )}
              {r.target_type === "user" && (
                <button onClick={() => act(banUserByReport, r.id)}
                  style={{ padding: "6px 12px", border: "none", borderRadius: 6, background: "var(--danger)", color: "#fff", fontSize: 13, fontWeight: 600 }}>
                  Ban user
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </main>
  );
}