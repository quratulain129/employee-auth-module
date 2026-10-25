// Gatekeepers for protected endpoints. They run on the SERVER for every request, so calling the API
// directly (curl, Postman, a modified frontend) cannot bypass them.
import { config } from '../config/env.js';
import { logAuthEvent, EVENTS } from '../services/logger.js';
import { getActiveUser } from '../services/accessControl.js';


export function requireAuth(req, res, next) {
  const result = getActiveUser(req);
  if (result && result !== 'expired') return next();

  if (result === 'expired') {
    logAuthEvent(EVENTS.SESSION_EXPIRED, { provider: req.session.user?.provider, email: req.session.user?.email, reason: 'absolute_lifetime', req });
    return req.session.destroy(() => {
      res.clearCookie(config.session.cookieName);
      res.status(401).json({ error: 'session_expired', message: 'Your session has expired. Please sign in again.' });
    });
  }
  logAuthEvent(EVENTS.ACCESS_DENIED, { reason: 'no_session', path: req.originalUrl.split('?')[0], req });
  return res.status(401).json({ error: 'unauthenticated', message: 'Sign in is required.' });
}

// Use AFTER requireAuth. 401 = "we don't know who you are"; 403 = "we know who you are, and you may not do this".
export function requireRole(role) {
  return (req, res, next) => {
    if (req.session.user.role === role) return next();
    logAuthEvent(EVENTS.ACCESS_DENIED, {
      provider: req.session.user.provider,
      email: req.session.user.email,
      reason: 'insufficient_role',
      path: req.originalUrl.split('?')[0],
      req,
    });
    return res.status(403).json({ error: 'forbidden', message: 'You do not have permission to access this resource.' });
  };
}
