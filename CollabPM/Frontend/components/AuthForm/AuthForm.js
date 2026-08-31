"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login, register, verifyEmail, resendCode } from "@/lib/auth";
import styles from "./AuthForm.module.css";
import { useEffect, useRef } from "react";
import { loginWithGoogle } from "@/lib/auth";
// ONE component powers /login and /register. Registration is now two steps:
// submit details -> enter the emailed 6-digit code -> verified + logged in.
export default function AuthForm({ mode }) {
  const isRegister = mode === "register";
  const router = useRouter();

  const [step, setStep] = useState("form"); // "form" | "verify"
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const googleBtnRef = useRef(null);

useEffect(() => {
  function renderButton() {
    if (!window.google || !googleBtnRef.current) return;
    window.google.accounts.id.initialize({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      callback: async (response) => {
        setError("");
        setLoading(true);
        try {
          await loginWithGoogle(response.credential);
          router.push("/home");
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      },
    });
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      theme: "outline", size: "large", width: 280,
    });
  }
  if (window.google) {
    renderButton();
  } else {
    const interval = setInterval(() => {
      if (window.google) {
        clearInterval(interval);
        renderButton();
      }
    }, 100);
    return () => clearInterval(interval);
  }
}, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      if (isRegister) {
        await register({ username, email, password });
        // Move to the code-entry step; the backend has emailed a code.
        setInfo("We sent a 6-digit code to " + email + ". Enter it below.");
        setStep("verify");
      } else {
        await login({ email, password });
        router.push("/home");
      }
    } catch (err) {
      // If login is blocked because the email isn't verified yet, drop the user
      // into the verify step so they can finish signing up.
      if (!isRegister && /verify/i.test(err.message)) {
        try {
          await resendCode(email);
        } catch {}
        setInfo("Your email isn't verified. We sent a new code to " + email + ".");
        setStep("verify");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await verifyEmail({ email, code });
      router.push("/home");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    setInfo("");
    try {
      await resendCode(email);
      setInfo("A new code has been sent to " + email + ".");
    } catch (err) {
      setError(err.message);
    }
  }

  // --- verify step ---
  if (step === "verify") {
    return (
      <div className={styles.card}>
        <h1 className={styles.title}>Verify your email</h1>
        <form onSubmit={handleVerify} className={styles.form}>
          {info && <p className={styles.info}>{info}</p>}
          <label className={styles.field}>
            <span>6-digit code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              required
              autoFocus
            />
          </label>
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? "Verifying..." : "Verify & continue"}
          </button>
        </form>
        <p className={styles.switch}>
          Didn&apos;t get it?{" "}
          <button type="button" className={styles.linkish} onClick={handleResend}>
            Resend code
          </button>
          <div style={{ textAlign: "center", margin: "16px 0 4px" }}>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>or</p>
            <div ref={googleBtnRef} style={{ display: "flex", justifyContent: "center" }} />
          </div>
        </p>
      </div>
    );
  }

  // --- details step ---
  return (
    <div className={styles.card}>
      <h1 className={styles.title}>{isRegister ? "Create account" : "Log in"}</h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        {isRegister && (
          <label className={styles.field}>
            <span>Username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
        )}

        <label className={styles.field}>
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>

        <label className={styles.field}>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        {!isRegister && (
          <div style={{ textAlign: "right", marginTop: -6 }}>
          <Link href="/forgot-password" style={{ fontSize: 13 }}>Forgot password?</Link>
          </div>
        )}

        {info && <p className={styles.info}>{info}</p>}
        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.submit} type="submit" disabled={loading}>
          {loading ? "Please wait..." : isRegister ? "Sign up" : "Log in"}
        </button>
      </form>

      <p className={styles.switch}>
        {isRegister ? (
          <>
            Already have an account? <Link href="/login">Log in</Link>
          </>
        ) : (
          <>
            No account yet? <Link href="/register">Create one</Link>
          </>
        )}
      </p>
    </div>
  );
}
