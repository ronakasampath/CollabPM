// The single place that knows how to talk to the Flask backend. Every network
// call in the app goes through apiFetch(), so headers, the base URL, the auth
// token, and error handling live in exactly one file.

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

// We keep the JWT in the browser's localStorage so it survives page reloads.
// (localStorage is per-origin, string-only, and only exists in the browser --
// hence the `typeof window` guards, because this code can also run on the
// server during Next.js rendering, where `window` doesn't exist.)
const TOKEN_KEY = "collabpm_token";

export function saveToken(token) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TOKEN_KEY, token);
  }
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

// path: e.g. "/auth/login". options.auth=true attaches the Bearer token.
export async function apiFetch(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };

  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    // The backend expects JSON, so we stringify the body object.
    body: body ? JSON.stringify(body) : undefined,
  });

  // Try to parse a JSON body even on errors (our API returns {error: ...}).
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    // Surface the server's message if it sent one; otherwise a generic note.
    const message =
      (data && (data.error || data.msg)) || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}
