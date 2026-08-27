"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

// URL: /settings. Account settings stub. Reads the real logged-in user from the
// backend; editing (change username / email / timezone) gets wired up later.
export default function SettingsPage() {
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setChecked(true));
  }, []);

  const box = {
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    background: "var(--surface)",
    padding: 16,
    marginBottom: 12,
  };
  const label = { display: "block", fontSize: 13, color: "var(--muted)", marginBottom: 4 };
  const value = { fontSize: 15 };

  return (
    <main style={{ maxWidth: 620, margin: "0 auto", padding: "28px 24px 80px" }}>
      <Link href="/home" style={{ fontSize: 14 }}>
        &larr; My dashboard
      </Link>
      <h1 style={{ margin: "14px 0 20px", fontSize: 24 }}>Account settings</h1>

      {!checked ? (
        <p style={{ color: "var(--muted)" }}>Loading...</p>
      ) : !user ? (
        <div style={box}>
          <p style={{ margin: 0 }}>
            You are not signed in. <Link href="/login">Log in</Link> to see your account.
          </p>
        </div>
      ) : (
        <>
          <div style={box}>
            <span style={label}>Username</span>
            <div style={value}>{user.username}</div>
          </div>
          <div style={box}>
            <span style={label}>Email</span>
            <div style={value}>{user.email}</div>
          </div>
          <div style={box}>
            <span style={label}>System role</span>
            <div style={value}>{user.system_role}</div>
          </div>
          <div style={box}>
            <span style={label}>Timezone</span>
            <div style={value}>{user.timezone}</div>
          </div>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            Editing these will be wired to the backend later.
          </p>
        </>
      )}
    </main>
  );
}
