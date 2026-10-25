// Login/callback/logout logic shared by both providers. Provider-specific details live in /providers.
import passport from 'passport';
import { config } from '../config/env.js';
import { googleAuthOptions } from '../providers/google.js';
import { buildAuthRequest, redeemCode, statesMatch, MicrosoftAuthError } from '../providers/microsoft.js';
import { checkDomain as evaluate, buildSessionUser, checkSession as getActiveUser } from './accessController.js';
import { logAuthEvent, EVENTS } from '../services/logger.js';// ---- Where to send the browser afterwards (allowlisted; never a URL taken from the request => no open redirect) ----
const pickClient = (v) => (v === 'xampp' ? 'xampp' : 'react');

// Optional email typed on the login page. Only a plausible email is forwarded; it just pre-fills the provider's form.
const EMAIL_SHAPE = /^[^\s@]{1,64}@[^\s@]{1,190}$/;
const pickHint = (v) => (typeof v === 'string' && EMAIL_SHAPE.test(v.trim()) ? v.trim() : undefined);

function redirectTo(res, client, kind, reason) {
  const q = reason ? encodeURIComponent(reason) : '';
  if (client === 'xampp') {
    const u = new URL(config.xamppTestUrl);
    u.searchParams.set('result', kind);
    if (reason) u.searchParams.set('reason', reason);
    return res.redirect(u.toString());
  }
  const paths = { success: '/profile', denied: `/access-denied?reason=${q}`, error: `/login?error=${q}` };
  return res.redirect(`${config.frontendUrl}${paths[kind]}`);
}

// Authorization failure: the person IS authenticated by the provider but not allowed in. No session is kept.
function deny(req, res, client, provider, identity, reason) {
  logAuthEvent(EVENTS.ACCESS_DENIED, { provider, email: identity?.email, reason, req });
  req.session.destroy(() => {
    res.clearCookie(config.session.cookieName);
    redirectTo(res, client, 'denied', reason);
  });
}

// Authentication failure: the provider flow itself failed or was cancelled.
function fail(req, res, client, provider, reason) {
  logAuthEvent(EVENTS.AUTH_FAILURE, { provider, reason, req });
  redirectTo(res, client, 'error', reason);
}

function providerErrorReason(query) {
  return query.error === 'access_denied' ? 'cancelled' : 'provider_error';
}

// ---- Shared final step: authorize, then create the session ----
function finishLogin(req, res, client, identity) {
  const decision = evaluate(identity);
  if (!decision.allowed) return deny(req, res, client, identity.provider, identity, decision.reason);

  const user = buildSessionUser(identity);
  // regenerate() issues a NEW session ID, so any ID an attacker planted before login becomes useless (session fixation defence).
  req.session.regenerate((err) => {
    if (err) return fail(req, res, client, identity.provider, 'session_error');
    req.session.user = user;
    req.session.loginAt = Date.now();
    req.session.save((saveErr) => {
      if (saveErr) return fail(req, res, client, identity.provider, 'session_error');
      logAuthEvent(EVENTS.LOGIN_SUCCESS, { provider: user.provider, email: user.email, req });
      redirectTo(res, client, 'success');
    });
  });
}

// ---- Google ----
export function googleStart(req, res, next) {
  const client = pickClient(req.query.client);
  if (!config.google.enabled) return fail(req, res, client, 'google', 'provider_not_configured');
  req.session.client = client; // remembered so the callback knows which page to return to
  passport.authenticate('google', googleAuthOptions(pickHint(req.query.hint)))(req, res, next);
}

export function googleCallback(req, res, next) {
  const client = pickClient(req.session?.client);
  if (!config.google.enabled) return fail(req, res, client, 'google', 'provider_not_configured');
  if (req.query.error) return fail(req, res, client, 'google', providerErrorReason(req.query));

  passport.authenticate('google', { session: false }, (err, identity, info) => {
    if (err || !identity) {
      const reason = /state/i.test(info?.message || err?.message || '') ? 'state_mismatch' : 'callback_failed';
      console.error('[google callback]', err?.name || 'no-error-object', err?.code || '', String(err?.message || info?.message || '').slice(0, 160)); // name only; messages can echo request details
      return fail(req, res, client, 'google', reason);
    }
    return finishLogin(req, res, client, identity);
  })(req, res, next);
}

// ---- Microsoft ----
export async function microsoftStart(req, res, next) {
  const client = pickClient(req.query.client);
  if (!config.microsoft.enabled) return fail(req, res, client, 'microsoft', 'provider_not_configured');
  try {
    const { url, saved } = await buildAuthRequest(pickHint(req.query.hint));
    req.session.client = client;
    req.session.msAuth = saved; // state + nonce + PKCE verifier live ONLY server-side
    req.session.save((err) => (err ? next(err) : res.redirect(url)));
  } catch (err) {
    next(err);
  }
}

export async function microsoftCallback(req, res) {
  const client = pickClient(req.session?.client);
  if (!config.microsoft.enabled) return fail(req, res, client, 'microsoft', 'provider_not_configured');
  if (req.query.error) return fail(req, res, client, 'microsoft', providerErrorReason(req.query));

  const saved = req.session?.msAuth;
  if (req.session) delete req.session.msAuth; // one-time use
  if (!saved || !req.query.code || !statesMatch(String(req.query.state || ''), saved.state)) {
    return fail(req, res, client, 'microsoft', 'state_mismatch');
  }
  try {
    const identity = await redeemCode({ code: String(req.query.code), saved });
    return finishLogin(req, res, client, identity);
  } catch (err) {
    console.error('[microsoft callback]', err.name, err instanceof MicrosoftAuthError ? err.reason : '');
    return fail(req, res, client, 'microsoft', err instanceof MicrosoftAuthError ? err.reason : 'token_exchange_failed');
  }
}

// ---- Session status & logout ----
export function sessionStatus(req, res) {
  const result = getActiveUser(req);
  if (result && result !== 'expired') {
    const { name, email, provider, role } = result;
    return res.json({ authenticated: true, user: { name, email, provider, role } });
  }
  return res.json({ authenticated: false, reason: result === 'expired' ? 'session_expired' : 'no_session' });
}

export function logout(req, res) {
  const user = req.session?.user;
  const finish = () => {
    res.clearCookie(config.session.cookieName);
    if (user) logAuthEvent(EVENTS.LOGOUT, { provider: user.provider, email: user.email, req });
    res.json({ ok: true });
  };
  if (!req.session) return finish();
  req.session.destroy(finish); // removes the server-side record: the old cookie is now worthless
}
