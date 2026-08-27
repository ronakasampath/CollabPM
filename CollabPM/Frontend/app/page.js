"use client";

// "use client" marks this as a Client Component: it runs in the browser and can
// use hooks (useState/useEffect) and read localStorage. Without it, a component
// is a Server Component by default in the App Router and can't use those.

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentUser, logout } from "@/lib/auth";
import styles from "./page.module.css";

export default function Home() {
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);

  // On mount, ask the backend "who am I?" using the stored token. If it fails
  // (no token / expired), we simply treat the visitor as logged out.
  useEffect(() => {
    getCurrentUser()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setChecked(true));
  }, []);

  return (
    <main className={styles.main}>
      <h1 className={styles.brand}>CollabPM</h1>
      <p className={styles.tagline}>Break projects into work, together.</p>

      {!checked ? (
        <p>Loading...</p>
      ) : user ? (
        <div className={styles.actions}>
          <p>
            Signed in as <strong>{user.username}</strong> ({user.system_role}).
          </p>
          <Link className={styles.button} href="/home">
            Go to your dashboard
          </Link>
          <Link className={styles.buttonOutline} href="/builder">
            Open the builder
          </Link>
          <button
            className={styles.linkButton}
            onClick={() => {
              logout();
              setUser(null);
            }}
          >
            Log out
          </button>
        </div>
      ) : (
        <div className={styles.actions}>
          <Link className={styles.button} href="/login">
            Log in
          </Link>
          <Link className={styles.buttonOutline} href="/register">
            Create account
          </Link>
          <Link className={styles.linkButton} href="/builder">
            Try the builder without logging in
          </Link>
          <Link className={styles.linkButton} href="/dashboard">
            View the sample dashboard
          </Link>
        </div>
      )}
    </main>
  );
}
