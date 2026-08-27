"use client";

import Link from "next/link";
import { useProjects, myTasks } from "@/lib/projectStore";

// URL: /users/<name>. A member's account page. `params` comes from the folder
// name [username]. Fed from the shared store for now.
export default function AccountPage({ params }) {
  const username = decodeURIComponent(params.username);
  const projects = useProjects();
  const mine = projects.filter((p) => p.members.includes(username));

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 80px" }}>
      <Link href="/home" style={{ fontSize: 14 }}>
        &larr; My dashboard
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "16px 0 24px" }}>
        <span
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "var(--accent)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontSize: 20,
            fontWeight: 700,
          }}
        >
          {username.slice(0, 2).toUpperCase()}
        </span>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>{username}</h1>
          <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: 14 }}>
            On {mine.length} project{mine.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {mine.map((project) => {
        const tasks = myTasks(project, username);
        const role = project.leader === username ? "Leader" : "Member";
        return (
          <section
            key={project.id}
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              background: "var(--surface)",
              padding: 16,
              marginBottom: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{project.name}</h2>
              <Link href={`/project?project=${project.id}`} style={{ fontSize: 13 }}>
                Open project &rarr;
              </Link>
            </div>
            <p style={{ margin: "2px 0 10px", color: "var(--muted)", fontSize: 13 }}>
              {role} &middot; {tasks.length} assigned task{tasks.length === 1 ? "" : "s"}
            </p>
            {tasks.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 14,
                  padding: "6px 0",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <span>
                  {t.title}
                  <span style={{ color: "var(--muted)", fontSize: 12 }}> — {t.path}</span>
                </span>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>
                  {t.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </section>
        );
      })}
    </main>
  );
}
