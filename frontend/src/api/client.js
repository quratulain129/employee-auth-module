// All backend calls go through here. "credentials: 'include'" makes the browser send the session cookie to the backend origin.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...options });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON body */ }
  return { status: res.status, ok: res.ok, data };
}

// Login is a full-page navigation (the browser must visit the provider), not a fetch.
export const loginUrl = (provider, email) => {
  const hint = email ? `?hint=${encodeURIComponent(email)}` : '';
  return `${API_BASE}/auth/${provider}${hint}`;
};
