// Microsoft Entra ID provider using MSAL Node (authorization code flow + PKCE).
import crypto from 'node:crypto';
import { ConfidentialClientApplication, CryptoProvider } from '@azure/msal-node';
import { config } from '../config/env.js';
import { normalizeMicrosoft } from '../services/identity.js';

const SCOPES = ['openid', 'profile', 'email'];
const cryptoProvider = new CryptoProvider();
let client;

function getClient() {
  if (!client) {
    client = new ConfidentialClientApplication({
      auth: {
        clientId: config.microsoft.clientId,
        clientSecret: config.microsoft.clientSecret,
        // Tenant-specific authority: only accounts from THIS directory can sign in.
        authority: `https://login.microsoftonline.com/${config.microsoft.tenantId}`,
      },
      system: { loggerOptions: { loggerCallback: () => {}, piiLoggingEnabled: false } },
    });
  }
  return client;
}

export class MicrosoftAuthError extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

// Step 1: build the Microsoft sign-in URL and the one-time values we must remember in the session.
export async function buildAuthRequest(loginHint) {
  const state = cryptoProvider.createNewGuid();
  const nonce = cryptoProvider.createNewGuid();
  const { verifier, challenge } = await cryptoProvider.generatePkceCodes();
  const url = await getClient().getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: config.microsoft.redirectUri,
    state,
    nonce,
    codeChallenge: challenge,
    codeChallengeMethod: 'S256',
    prompt: 'select_account',
    ...(loginHint ? { loginHint } : {}), // pre-fills the email on Microsoft's page
  });
  return { url, saved: { state, nonce, verifier } };
}

export function statesMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Step 2: exchange the one-time code for tokens (server-to-server, using the Client Secret).
// MSAL validates the ID token signature, issuer, audience and expiry. We additionally check the nonce.
export async function redeemCode({ code, saved }) {
  const result = await getClient().acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri: config.microsoft.redirectUri,
    codeVerifier: saved.verifier,
  });
  const claims = result?.idTokenClaims;
  if (!claims) throw new MicrosoftAuthError('no_id_token');
  if (claims.nonce !== saved.nonce) throw new MicrosoftAuthError('nonce_mismatch'); // replay protection
  return normalizeMicrosoft(claims);
}
