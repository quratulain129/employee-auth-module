# 05. Requirements matrix

Tests: **AUTO** = `npm test` (file in `backend/tests`), **T##** = manual test in `02-test-plan.md`. "Verified" only after you run them.

| Requirement | Implemented in | Verified by |
|---|---|---|
| Google login | `providers/google.js`, `authController.js`, `routes/authRoutes.js` | T01, T02 |
| Microsoft login (MSAL code flow) | `providers/microsoft.js`, `authController.js` | T03, T04 |
| Modular providers | `providers/*`, `services/identity.js` | code review; AUTO accessControl |
| Cancellation / provider errors / callback failure | `authController.js` (`fail`, reason codes), `frontend/src/auth/messages.js` | T05, T06, T17 |
| Normalized profile | `services/identity.js`, `accessControl.buildSessionUser` | AUTO api (profile) |
| Not auto-merge accounts | `buildSessionUser` id = provider:subject | AUTO accessControl |
| Google domain restriction | `accessControl.evaluateGoogle`, `config/env.js` | AUTO accessControl, T01, T02 |
| Microsoft tenant restriction | `evaluateMicrosoft`, tenant authority in `providers/microsoft.js` | AUTO accessControl, T03, T04 |
| Access Denied page, no session on failure | `AccessDeniedPage.jsx`, `deny()` | T02, T04 |
| Session after auth+authz only | `finishLogin` | T01, T02 |
| Idle expiry | `config/session.js` (rolling, maxAge) | T11 |
| Absolute expiry | `requireAuth.js` | AUTO api |
| Cookie settings | `config/session.js` | T07 |
| Session regeneration | `finishLogin` (`regenerate`) | code review; T13 |
| Logout destroys session | `authController.logout` | AUTO api, T12, T13 |
| Protected middleware | `middleware/requireAuth.js`, `apiRoutes.js` | AUTO api, T08, T09, T14 |
| 401 vs 403 vs 200 demo | `requireRole`, `/api/admin/report` | AUTO api, T10 |
| Secrets in `.env`, `.env.example`, `.gitignore` | `.env.example`, `.gitignore`, `config/env.js` | T16, T19 |
| Secure error handling | `middleware/errorHandler.js` | T17 |
| auth.log events | `services/logger.js` | T15 |
| Route table | `README.md` | review |
| React pages incl. loading/error/expired | `frontend/src/pages`, `AuthContext.jsx`, `Feedback.jsx` | T01, T11, T12 |
| XAMPP HTML page | `xampp-test/auth-test.html`, CORS in `app.js` | T18 |
| Helmet, CORS allowlist | `app.js` | AUTO api (CORS) |
| Docs, checklist, report, demo, interview | `docs/01-06`, `README.md` | review |
| Not implemented / pending | Real-provider verification, company approvals | — |
