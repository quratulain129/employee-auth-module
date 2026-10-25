// AUTHORIZATION. The provider proved WHO the person is (authentication).
// Here we decide whether that person may use THIS application. No session is created unless this says "allowed".
import { config } from '../config/env.js';

export const DENY = {
  MISSING_EMAIL: 'missing_email',
  EMAIL_UNVERIFIED: 'email_unverified',
  DOMAIN_NOT_ALLOWED: 'domain_not_allowed',
  HOSTED_DOMAIN_MISMATCH: 'hosted_domain_mismatch',
  GOOGLE_POLICY_NOT_SET: 'google_policy_not_configured',
  TENANT_MISMATCH: 'tenant_mismatch',
  MISSING_SUBJECT: 'missing_subject',
};

const allow = () => ({ allowed: true });
const deny = (reason) => ({ allowed: false, reason });

export function evaluateGoogle(identity, cfg = config.google) {
  if (!identity.subject) return deny(DENY.MISSING_SUBJECT);
  if (!identity.email || !identity.email.includes('@')) return deny(DENY.MISSING_EMAIL);
  if (!identity.emailVerified) return deny(DENY.EMAIL_UNVERIFIED);

    // Development only: Google already limits sign-in to the project's Test users.
  if (cfg.trustTestUsers) return allow();

  // Development-only allowlist of exact test addresses (empty in production via config).
  if (cfg.devAllowedEmails.includes(identity.email)) return allow();

  if (cfg.allowedDomains.length === 0) return deny(DENY.GOOGLE_POLICY_NOT_SET); // fail closed

  const emailDomain = identity.email.split('@')[1];
  if (!cfg.allowedDomains.includes(emailDomain)) return deny(DENY.DOMAIN_NOT_ALLOWED);

  // An email domain string alone is weak evidence. Google's "hd" (hosted domain) claim states the
  // Workspace organization that owns the account, so it must be present and must match.
  if (identity.hostedDomain !== emailDomain) return deny(DENY.HOSTED_DOMAIN_MISMATCH);
  return allow();
}

export function evaluateMicrosoft(identity, cfg = config.microsoft) {
  if (!identity.subject) return deny(DENY.MISSING_SUBJECT);
  // "tid" comes from a token whose signature MSAL has already verified.
  if (!identity.tenantId || identity.tenantId !== cfg.tenantId) return deny(DENY.TENANT_MISMATCH);
  return allow();
}

export function evaluate(identity) {
  return identity.provider === 'google' ? evaluateGoogle(identity) : evaluateMicrosoft(identity);
}

// Builds the object stored in the session. Role comes from ADMIN_USERS, NOT from anything the browser sends.
export function buildSessionUser(identity, admins = config.adminUsers) {
  const role = admins.includes(`${identity.provider}:${identity.email}`) ? 'admin' : 'employee';
  return {
    id: `${identity.provider}:${identity.subject}`,
    provider: identity.provider,
    providerSubject: identity.subject,
    tenantId: identity.tenantId,
    name: identity.name,
    email: identity.email,
    role,
  };
}
// ---- Session check (lives here so the domain check and the session check are in ONE access controller) ----
const absoluteMs = () => config.session.absoluteHours * 60 * 60 * 1000;

// Returns the signed-in user, 'expired' (past the absolute lifetime), or null (no session).
export function getActiveUser(req) {
  const user = req.session?.user;
  if (!user) return null;
  if (Date.now() - (req.session.loginAt || 0) > absoluteMs()) return 'expired';
  return user;
}