// Converts each provider's different profile format into ONE consistent shape.
// Account policy: identity = provider + that provider's stable subject ID. Same email on two providers = two separate accounts.

export function normalizeGoogle(profile) {
  const raw = profile._json || {};
  return {
    provider: 'google',
    subject: profile.id || raw.sub,                       // Google's stable user ID ("sub")
    name: profile.displayName || raw.name || '',
    email: String(raw.email || '').toLowerCase(),
    emailVerified: raw.email_verified === true || raw.email_verified === 'true',
    hostedDomain: raw.hd ? String(raw.hd).toLowerCase() : undefined, // set by Google only for Workspace accounts
  };
}

export function normalizeMicrosoft(claims) {
  return {
    provider: 'microsoft',
    subject: claims.oid || claims.sub,                    // "oid" = object ID of the user in that tenant
    tenantId: claims.tid ? String(claims.tid).toLowerCase() : undefined,
    name: claims.name || '',
    // "email" is optional in Entra tokens; "preferred_username" is usually the sign-in name (UPN).
    email: String(claims.email || claims.preferred_username || '').toLowerCase(),
  };
}
