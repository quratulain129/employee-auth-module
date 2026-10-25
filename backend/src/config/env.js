// Central configuration. Every other file imports settings from here instead of reading process.env.
// Why: one place to validate values, one place to change names, and no secret ever leaves the backend.
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');

// Tests must not pick up a developer's real .env file.
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.join(backendRoot, '.env') });
}

const e = process.env;
const list = (v) => (v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const posInt = (v, fallback) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const stripSlash = (u) => (u || '').replace(/\/+$/, '');
const isPlaceholder = (v) => !v || v.startsWith('REPLACE_WITH');
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const env = e.NODE_ENV || 'development';
const isProd = env === 'production';
const port = posInt(e.PORT, 5000);

// Fail closed: without a strong session secret the server must not start.
if (!e.SESSION_SECRET || e.SESSION_SECRET.length < 32 || isPlaceholder(e.SESSION_SECRET)) {
  throw new Error(
    'SESSION_SECRET is missing or too short (min 32 chars). Generate one with: ' +
      `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  );
}

const backendUrl = stripSlash(e.BACKEND_URL) || `http://localhost:${port}`;
const frontendUrl = stripSlash(e.FRONTEND_URL) || 'http://localhost:5173';
const xamppTestUrl = (e.XAMPP_TEST_URL || 'http://localhost/pl-auth-test/auth-test.html').trim();

const googleReady = !isPlaceholder(e.GOOGLE_CLIENT_ID) && !isPlaceholder(e.GOOGLE_CLIENT_SECRET);
const msTenant = (e.MS_TENANT_ID || '').trim();
// "common", "organizations" and "consumers" are NOT specific tenants, so a GUID is mandatory.
const msReady = !isPlaceholder(e.MS_CLIENT_ID) && !isPlaceholder(e.MS_CLIENT_SECRET) && GUID.test(msTenant);

export const config = {
  env,
  isProd,
  port,
  backendUrl,
  frontendUrl,
  xamppTestUrl,
  trustProxy: e.TRUST_PROXY === 'true', // set only when deployed behind a reverse proxy
  corsOrigins: [...new Set([new URL(frontendUrl).origin, new URL(xamppTestUrl).origin])],
  session: {
    secret: e.SESSION_SECRET,
    cookieName: 'pl_auth.sid',
    idleMinutes: posInt(e.SESSION_IDLE_MINUTES, 15),
    absoluteHours: posInt(e.SESSION_ABSOLUTE_HOURS, 8),
  },
  google: {
    enabled: googleReady,
    clientId: e.GOOGLE_CLIENT_ID,
    clientSecret: e.GOOGLE_CLIENT_SECRET,
    callbackUrl: `${backendUrl}/auth/google/callback`,
    allowedDomains: list(e.ALLOWED_GOOGLE_DOMAINS),
    // Development shortcut only. Ignored in production.
    devAllowedEmails: isProd ? [] : list(e.DEV_ALLOWED_EMAILS),
    // Development only: trust Google's "Test users" list. Always false in production.
    trustTestUsers: isProd ? false : e.DEV_TRUST_GOOGLE_TEST_USERS === 'true',
  },
  microsoft: {
    enabled: msReady,
    clientId: e.MS_CLIENT_ID,
    clientSecret: e.MS_CLIENT_SECRET,
    tenantId: msTenant.toLowerCase(),
    redirectUri: `${backendUrl}/auth/microsoft/callback`,
  },
  adminUsers: list(e.ADMIN_USERS), // entries look like "google:name@domain" or "microsoft:name@domain"
  logFile: path.join(backendRoot, 'logs', 'auth.log'),
};
