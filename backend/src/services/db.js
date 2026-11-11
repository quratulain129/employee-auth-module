// PostgreSQL database service for Employee Auth Module.
// Connects to PostgreSQL (Docker/pgAdmin) and records authenticated users and access logs.
import fs from 'node:fs';
import pg from 'pg';
import { config } from '../config/env.js';

const pool = config.databaseUrl ? new pg.Pool({ connectionString: config.databaseUrl }) : null;
pool?.on('error', (err) => console.error('[database] Connection error:', err.message));

// Runs schema.sql to ensure all required tables exist in PostgreSQL
export async function initDb() {
  if (!pool) {
    console.log('[database] No DATABASE_URL set: running in file-only logging mode (events go to auth.log).');
    return;
  }
  const schemaPath = new URL('../../schema.sql', import.meta.url);
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('[database] PostgreSQL connected and tables initialized successfully.');
}

// Inserts or updates user record upon successful login. Returns user's database id.
export async function saveUser({ provider, email, name, role = 'employee' }) {
  if (!pool) return null;
  try {
    const cleanEmail = (email || '').toLowerCase().trim();
    const r = await pool.query(
      `INSERT INTO users (provider, email, name, role, last_login)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (email) DO UPDATE
       SET name = COALESCE(EXCLUDED.name, users.name),
           provider = EXCLUDED.provider,
           role = COALESCE(EXCLUDED.role, users.role),
           last_login = now()
       RETURNING id`,
      [provider, cleanEmail, name || null, role]
    );
    return r.rows[0]?.id ?? null;
  } catch (err) {
    console.error('[database] Could not save user:', err.message);
    return null;
  }
}

// Saves an authentication event (LOGIN_SUCCESS, LOGOUT, ACCESS_DENIED, etc.) to access_logs and login_history.
export function saveEvent({ event, provider, userId, email, reason, ip, durationSeconds, userAgent, sessionId }) {
  if (!pool) return;
  const cleanEmail = email ? email.toLowerCase().trim() : null;

  // 1. Insert into access_logs (the primary table viewable in pgAdmin)
  pool
    .query(
      `INSERT INTO access_logs (event_type, provider, email, reason, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [event, provider ?? null, cleanEmail, reason ?? null, ip ?? null, userAgent ?? null]
    )
    .catch((err) => console.error('[database] Could not write to access_logs:', err.message));

  // 2. Also record in login_history for comprehensive tracking
  pool
    .query(
      `INSERT INTO login_history (event, provider, user_id, email, reason, ip, duration_seconds, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
      [event, provider ?? null, userId ?? null, cleanEmail, reason ?? null, ip ?? null, durationSeconds ?? null]
    )
    .catch(() => {});

  // 3. Record session lifecycle in user_sessions
  if (sessionId) {
    if (event === 'LOGIN_SUCCESS') {
      saveSession({ sessionId, email: cleanEmail, provider, event: 'login' });
    } else if (event === 'LOGOUT') {
      saveSession({ sessionId, email: cleanEmail, provider, event: 'logout', durationSeconds });
    }
  }
}

// Records session lifecycle in user_sessions
export function saveSession({ sessionId, email, provider, event = 'login', durationSeconds }) {
  if (!pool || !sessionId) return;
  const cleanEmail = email ? email.toLowerCase().trim() : null;

  if (event === 'login') {
    pool
      .query(
        `INSERT INTO user_sessions (session_id, email, provider, login_time)
         VALUES ($1, $2, $3, now())`,
        [sessionId, cleanEmail, provider ?? null]
      )
      .catch(() => {});
  } else if (event === 'logout') {
    pool
      .query(
        `UPDATE user_sessions
         SET logout_time = now(), duration_seconds = $2
         WHERE session_id = $1`,
        [sessionId, durationSeconds ?? null]
      )
      .catch(() => {});
  }
}
