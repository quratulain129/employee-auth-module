// Writes one JSON line per authentication event to logs/auth.log.
// The helper accepts ONLY a fixed set of fields, so tokens, codes, secrets and session IDs cannot be logged by accident.
import fs from 'node:fs';
import path from 'node:path';
import winston from 'winston';
import { config } from '../config/env.js';

fs.mkdirSync(path.dirname(config.logFile), { recursive: true });

const fileLogger = winston.createLogger({
  level: 'info',
  silent: config.env === 'test',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...rest }) =>
      JSON.stringify({ timestamp, level, event: message, ...rest })
    )
  ),
  transports: [new winston.transports.File({ filename: config.logFile, maxsize: 5 * 1024 * 1024, maxFiles: 5 })],
});

// "alice@example.com" -> "al***@example.com": enough to troubleshoot, not enough to expose the full address.
export function maskEmail(email) {
  if (!email || !email.includes('@')) return undefined;
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}

export const EVENTS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGOUT: 'LOGOUT',
  ACCESS_DENIED: 'ACCESS_DENIED',
  AUTH_FAILURE: 'AUTH_FAILURE',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
};

export function logAuthEvent(event, { provider, email, reason, req, path: reqPath } = {}) {
    const level = [EVENTS.LOGIN_SUCCESS, EVENTS.LOGOUT, EVENTS.SESSION_ENDED].includes(event) ? 'info' : 'warn';
  fileLogger.log(level, event, {
    provider,
    user: maskEmail(email),
    reason,
    path: reqPath,
    ip: req?.ip,
  });
}
