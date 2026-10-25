// Server-side session setup. The browser only holds an opaque, random session ID in a cookie;
// the real data (who you are) stays in server memory.
import session from 'express-session';
import { config } from './env.js';

export const sessionMiddleware = session({
  name: config.session.cookieName,
  secret: config.session.secret, // signs the cookie so it cannot be forged
  resave: false,                 // do not re-save unchanged sessions
  saveUninitialized: false,      // no cookie for visitors who never started a login
  rolling: true,                 // every request refreshes the idle timer (sliding expiry)
  // NOTE: no "store" option => MemoryStore. Fine for a local prototype ONLY (see docs/06).
  cookie: {
    httpOnly: true,                 // JavaScript cannot read the cookie (limits XSS damage)
    secure: config.isProd,          // production: HTTPS only. Local http://localhost needs false.
    sameSite: 'lax',                // not sent on cross-site POSTs (CSRF defence) but sent on the provider's redirect back
    maxAge: config.session.idleMinutes * 60 * 1000, // idle lifetime
  },
});
