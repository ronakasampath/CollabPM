// Thin wrappers around the auth endpoints. UI components call these instead of
// touching apiFetch directly, so the "shape" of each auth call lives in one place.

import { apiFetch, saveToken, clearToken } from "@/lib/api";

export async function register({ username, email, password }) {
  // Returns { message, email, verification_required } -- NO token yet. The user
  // must confirm the emailed code via verifyEmail() before they can log in.
  return apiFetch("/auth/register", {
    method: "POST",
    body: { username, email, password },
  });
}

export async function verifyEmail({ email, code }) {
  const data = await apiFetch("/auth/verify", {
    method: "POST",
    body: { email, code },
  });
  if (data && data.access_token) saveToken(data.access_token);
  return data;
}

export async function resendCode(email) {
  return apiFetch("/auth/resend", { method: "POST", body: { email } });
}

export async function login({ email, password }) {
  const data = await apiFetch("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  if (data && data.access_token) saveToken(data.access_token);
  return data;
}

export async function getCurrentUser() {
  return apiFetch("/auth/me", { auth: true });
}

export function logout() {
  clearToken();
}



export async function loginWithGoogle(credential) {
  const data = await apiFetch("/auth/google", { method: "POST", body: { credential } });
  if (data && data.access_token) saveToken(data.access_token);
  return data;
}

export async function requestPasswordReset(email) {
  return apiFetch("/auth/forgot-password", { method: "POST", body: { email } });
}
export async function resetPassword(token, password) {
  return apiFetch("/auth/reset-password", { method: "POST", body: { token, password } });
}
