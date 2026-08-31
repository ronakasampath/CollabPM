"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { resetPassword } from "@/lib/auth";
import styles from "./AuthForm.module.css";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className={styles.card}><p>Loading...</p></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return <div className={styles.card}><p className={styles.error}>Missing or invalid reset link.</p></div>;
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>Set a new password</h1>
      {done ? (
        <p className={styles.info}>Password reset. Redirecting to log in...</p>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.field}>
            <span>New password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </label>
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? "Saving..." : "Reset password"}
          </button>
        </form>
      )}
    </div>
  );
}