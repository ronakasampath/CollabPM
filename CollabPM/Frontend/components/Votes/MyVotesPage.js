"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listMyVotes } from "@/lib/votes";

export default function MyVotesPage() {
  const [votes, setVotes] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listMyVotes().then((d) => setVotes(d.votes)).catch((e) => setError(e.message));
  }, []);

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "28px 24px 80px" }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 26 }}>My Votes</h1>
      <p style={{ color: "var(--muted)", margin: "0 0 20px" }}>Votes you've called, across all projects.</p>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {votes === null ? (
        <p style={{ color: "var(--muted)" }}>Loading...</p>
      ) : votes.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>You haven't called any votes yet.</p>
      ) : (
        votes.map((v) => {
          const closed = new Date(v.closes_at).getTime() <= Date.now();
          return (
            <Link
              key={v.id}
              href={`/project?project=${v.project_id}`}
              style={{
                display: "block", padding: 14, marginBottom: 10, border: "1px solid var(--border)",
                borderRadius: "var(--radius)", background: "var(--surface)", textDecoration: "none", color: "inherit",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 15 }}>{v.title}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                {v.total_votes} votes &middot; {closed ? "closed" : "open"}
              </div>
            </Link>
          );
        })
      )}
    </main>
  );
}