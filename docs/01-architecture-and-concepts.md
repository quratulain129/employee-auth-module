# 01. Architecture, concepts and code walkthrough

## 1. Big picture

```
Browser (React :5173 or XAMPP page :80)
   │  1. click "Sign in with X"  (full-page navigation)
   ▼
Express backend :5000  ──2. redirect──►  Google / Microsoft sign-in page
   ▲                                          │ 3. user signs in
   │  4. provider redirects back with ?code=…  │
   └──────────────────────────────────────────┘
Backend (server-to-server): exchange code + Client Secret for tokens/profile
   → normalize identity → accessControl (authorization) → allowed?
        yes: regenerate session ID, store user server-side, set cookie, redirect to app
        no : no session, log ACCESS_DENIED, redirect to Access Denied page
Later requests: browser sends cookie → requireAuth looks up the session → 401/403/200
```

## 2. Key concepts (plain English)

- **Authentication** = proving who you are (Google/Microsoft do this). **Authorization** = deciding what you may do here (our `accessControl.js`). A valid Google login does not mean "allowed in".
- **OAuth 2.0** = a way for an app to get *permission/tokens* from a provider. It is about delegated access, not identity. **OpenID Connect (OIDC)** = a thin layer on top of OAuth 2.0 that adds an **ID token** (signed proof of who logged in). We use OIDC scopes `openid profile email`.
- **Authorization code flow**: browser gets only a short-lived *code*; our backend swaps it for tokens using the Client Secret. Tokens never pass through the browser.
- **Why validate identity**: a forged or replayed token could impersonate an employee. We rely on: HTTPS back-channel exchange, signature/issuer/audience checks (MSAL), `state` (stops forged callbacks), `nonce` (stops token replay), PKCE (stops code interception), `email_verified`, `hd`, `tid`.
- **Callback URL must match exactly**: the provider only sends codes to pre-registered URLs; otherwise anyone could redirect codes to an attacker's site.
- **Cookie flags**: `httpOnly` (JavaScript cannot read it), `secure` (HTTPS only; off locally because http://localhost), `sameSite=lax` (not sent on cross-site POST; still sent when the provider redirects back), `maxAge` (browser-side lifetime = idle timeout).
- **Session vs cookie lifetime**: cookie only holds a random ID. The server-side session is the truth. Idle timeout = 15 min of no requests (`rolling`); absolute limit = 8 h from login even if active.
- **Why an email domain alone is not proof**: attackers can create accounts with look-alike or user-controlled emails, some providers allow unverified or alias addresses. So Google must also show a verified email and the `hd` Workspace claim; Microsoft is restricted by **tenant ID** (`tid`), which identifies the organization's directory.
- **Why accounts are not merged by email**: email can be reassigned or spoofed by an unverified source. Identity = `provider:subject` (Google `sub`, Microsoft `oid`).

## 3. Module walkthrough (what, why, how it connects, risks, mistakes)

| File | Purpose / key functions | Connects to | Security notes / common mistakes |
|---|---|---|---|
| `config/env.js` | Loads `.env`, validates, exports one `config` object. Refuses to start without a strong `SESSION_SECRET`. Providers are `enabled` only if fully configured; tenant must be a GUID. | imported by almost everything | Mistake: spaces/quotes in `.env`, restart needed after edits. Never read `process.env` elsewhere. |
| `config/session.js` | Configures `express-session`: cookie flags, rolling idle timeout. | `app.js` | Memory store = prototype only. `secure:true` in production needs HTTPS or the cookie is never stored. |
| `services/logger.js` | `logAuthEvent(event, fields)` writes JSON lines. Accepts a fixed field list only; masks emails (`al***@domain`). | controllers, middleware | Cannot log tokens/codes/session IDs because there is no field for them. |
| `services/identity.js` | `normalizeGoogle`, `normalizeMicrosoft` → common shape. | providers, controller | Keeps provider quirks out of the rest of the code. |
| `services/accessControl.js` | `evaluateGoogle/Microsoft` → `{allowed, reason}`; `buildSessionUser` assigns role from `ADMIN_USERS`. | controller | Fails closed when no Google policy exists. Dev email allowlist ignored in production. |
| `providers/google.js` | Registers passport strategy (state on), returns auth options. `hd` hint is only UX. | `authController` | Callback URL must match console. |
| `providers/microsoft.js` | `buildAuthRequest` (state, nonce, PKCE), `redeemCode` (MSAL exchange + nonce check). Tenant-specific authority. | `authController` | Using `common` authority would admit any account; code avoids it. |
| `controllers/authController.js` | Start/callback per provider; `finishLogin` = authorize → regenerate session → store user → redirect. Logout destroys session. Redirect targets come from an allowlist (`react`/`xampp`), never from request URLs. | routes | Denied users get no session. Errors map to short reason codes. |
| `middleware/requireAuth.js` | `requireAuth` (401 if no/expired session), `requireRole` (403). Enforces absolute lifetime. | `apiRoutes` | Protection is server-side, so curl cannot bypass it. |
| `middleware/errorHandler.js` | Generic JSON 404/500. | `app.js` | No stack traces to clients. |
| `app.js` | Order matters: helmet → CORS → JSON → session → passport → routes → 404 → error handler. | all | CORS allowlist + `credentials:true`; never `*` with credentials. |
| `frontend/src/auth/AuthContext.jsx` | Asks `/auth/session` on load; tracks `expired`. | pages | UI state is a convenience; the backend is the authority. |
| `frontend/src/pages/*` | Login, Profile, Access Denied. | router | Client Secret never exists here; `VITE_*` values are public. |

## 4. Request/response flows

**Successful login:** `GET /auth/google` → 302 Google → user signs in → `GET /auth/google/callback?code&state` → passport checks `state`, swaps code (server-side) → identity normalized → `evaluate()` allowed → `session.regenerate` → `session.user` stored → `LOGIN_SUCCESS` logged → 302 `/profile` → React calls `/api/profile` with cookie → 200.
**Denied:** same until `evaluate()` says no → session destroyed → `ACCESS_DENIED` logged → 302 `/access-denied?reason=…`.
**Expired session:** after 15 idle minutes the store drops the session → API returns 401 → React shows "Your session expired".

## 5. Comprehension checkpoints (answers included)

**Checkpoint A (after sections 1-2)**
1. *Authentication vs authorization?* **A:** Authentication proves identity (provider). Authorization decides permission in our app (`accessControl.js`, roles). A Gmail user can authenticate fine and still be denied.
2. *Why must the callback URL match?* **A:** The provider sends the one-time code only to registered URLs. Without matching, an attacker could register their own URL and capture codes.

**Checkpoint B (after sessions)**
3. *Why does the backend create the session instead of trusting the frontend?* **A:** Anything the browser holds can be edited by the user. The server stores identity privately and gives the browser only an unguessable ID.
4. *Why must protected APIs check the session?* **A:** Anyone can call an API directly with curl, skipping React. Only server-side checks are real security; React route guards are cosmetic.
5. *What happens when a session expires?* **A:** The store removes it (idle) or `requireAuth` destroys it (absolute); the cookie then maps to nothing, API returns 401, the UI asks the user to sign in again.

**Checkpoint C (after providers)**
6. *Why are provider identity and organizational authorization separate?* **A:** The provider only vouches for the person; whether *this company app* admits them is our policy, and policy changes (new domain, new tenant) without touching provider code.
7. *Why must the Client Secret never appear in React?* **A:** All frontend code is downloadable by every visitor. A leaked secret lets others impersonate the application to the provider.
8. *Why is provider code kept separate?* **A:** Each provider has different libraries and claims. Isolating them in `providers/` lets us add or fix one without breaking the shared flow, and keeps tests simple.
