# 04. Mock interview with your line manager

1. **Why two providers and how did you keep them separate?** Employees may be on Google Workspace or Microsoft 365. Each has its own library and claims, so `providers/` holds only provider code, `identity.js` normalizes to one shape, and `accessControl.js`/controller are shared.
2. **Authentication vs authorization here?** Provider proves who the user is. `accessControl.js` decides whether they may enter (domain + `hd` for Google, tenant ID for Microsoft, optional roles).
3. **Is checking the email domain enough?** No. Email strings can be unverified or look-alike. Google must also be `email_verified` and have a matching `hd` Workspace claim; Microsoft is bound to a single tenant ID checked after MSAL validates the token.
4. **Where does the Client Secret live?** Only in backend `.env` (git-ignored), used for the server-to-server code exchange; never in React, HTML test page, logs or the repo.
5. **Why authorization code flow and not tokens in the browser?** Tokens stay on the server; the browser only handles a one-time code and a session cookie.
6. **What do state, nonce and PKCE do?** State ties the callback to the browser that started it (CSRF). Nonce ties the ID token to that login (replay). PKCE stops a stolen code being redeemed by someone else.
7. **How do you prevent session fixation?** `session.regenerate()` issues a new ID after authorization succeeds.
8. **Explain the cookie flags.** `httpOnly` blocks JS access; `secure` forces HTTPS in production; `sameSite=lax` blocks cross-site POST sends but allows the provider redirect; `maxAge` + rolling gives idle expiry.
9. **What happens on logout/expiry?** Server session is destroyed and the cookie cleared; the old cookie maps to nothing, so APIs return 401.
10. **How do you know the API is protected if someone bypasses React?** Middleware runs server-side on every `/api` request; tests and curl show 401/403.
11. **Why not a database or Redis?** Out of scope for the prototype; MemoryStore loses sessions on restart and does not scale across servers. Production needs a persistent store (e.g. Redis) plus HTTPS and secure cookies.
12. **What would you not claim about this system?** That it is production-ready or fully tested; real-account tests depend on provider setup and IT approval, and I report only results I executed.
13. **What does IT need to approve?** Tenant ID and approved domains, app registrations and consent, callback URLs/domain, secret management, HTTPS, session store, logging/retention, deployment and monitoring.
14. **What is logged?** Timestamp, event type, provider, masked user, reason code, IP; never passwords, codes, tokens, session IDs or secrets.
15. **Why POST for logout?** It changes state; GET could be triggered by a link/image from another site.
16. **What are the known weaknesses?** No rate limiting, no CSRF tokens beyond SameSite/CORS/POST design, local-file logs, in-memory sessions, `hd` behaviour needs real Workspace validation.
