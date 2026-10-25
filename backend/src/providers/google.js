// Google provider: passport-google-oauth20 performs the server-side authorization-code exchange
// (our server talks directly to Google with the Client Secret; the browser never sees it).
import passport from 'passport';
import googleOauth from 'passport-google-oauth20';
import { config } from '../config/env.js';
import { normalizeGoogle } from '../services/identity.js';

const GoogleStrategy = googleOauth.Strategy;

export function registerGoogleStrategy() {
  if (!config.google.enabled) return;
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl, // must match the Google Cloud Console value EXACTLY
        scope: ['openid', 'profile', 'email'],
        state: true, // random "state" stored in the session and checked on return (CSRF protection)
      },
      // Runs after Google returns a profile. We only normalize here; authorization happens in the controller.
      (accessToken, refreshToken, profile, done) => done(null, normalizeGoogle(profile))
    )
  );
}

export function googleAuthOptions(loginHint) {
  const opts = { session: false, prompt: 'select_account' };
  if (loginHint) opts.loginHint = loginHint; // pre-fills the email on Google's page (a convenience, not a security check)
  // "hd" only pre-filters Google's account chooser (a UI hint). It is NOT a security check; accessControl.js is.
  if (config.google.allowedDomains.length === 1) opts.hd = config.google.allowedDomains[0];
  return opts;
}
