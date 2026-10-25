# 03. Documentation checklist, final report outline, demo plan

Never fabricate screenshots, results or approvals. Redact: client secrets, session secret, cookie values, authorization codes, tokens, full tenant/client IDs if your manager asks, other people's emails.

## A. Checklist by stage

| Stage | Daily-report wording (edit to match what you really did) | Screenshots | Decisions to record | Evidence to save | Hide |
|---|---|---|---|---|---|
| 1 Environment | "Installed/verified Node, npm, Git; created project." | `node -v`, `npm -v`, `git --version` | Node version; why Express/React/Vite | terminal output | nothing sensitive |
| 2 Backend install + tests | "Installed dependencies, ran automated tests." | `npm test` summary | package list and purpose | test output file | – |
| 3 Config | "Created `.env` from template; generated session secret." | `.env.example`, `git check-ignore` output | which values public vs secret | – | **entire `.env` content** |
| 4 Frontend | "Ran login/profile/denied pages." | login page, profile, access denied | why Vite, no secrets in `VITE_*` | screenshots | – |
| 5 Google registration | "Created OAuth client; set callback URL." | consent screen settings, redirect URI field | Internal vs External; dev allowlist reason | – | client secret, test users' emails |
| 6 Microsoft registration | "Registered single-tenant app, redirect URI, secret." | Overview (blur IDs), redirect URI, supported account types | single tenant, no `common` | – | secret value, tenant/client IDs if requested |
| 7 XAMPP | "Served HTML test page; verified CORS/cookies." | XAMPP running, page results, DevTools network/cookies | origin vs site explanation | HAR/screenshots | cookie values |
| 8 Architecture | "Documented folder structure and flows." | folder tree in Cursor | module responsibilities | diagram | – |
| 9 Restrictions | "Configured domain/tenant policy." | allowed + denied outcomes | hd/tid checks; fail-closed | log lines | real emails |
| 10 Sessions | "Verified cookie flags, expiry, logout." | cookie panel, expiry test | idle 15 min / absolute 8 h | T07/T11-T13 | session IDs |
| 11 Routes/middleware | "Tested 401/403/200 via curl." | curl outputs | 401 vs 403; POST logout | T08-T14 | cookies |
| 12 Logging | "Reviewed auth.log events." | redacted log | fields logged and excluded | log excerpt | any identifiers beyond masked |
| 13 Problems | One line each: symptom → cause → fix | error screenshots | – | – | secrets in errors |
| 14 Limitations | "Listed prototype limits and production needs." | – | `docs/06` items | – | – |

## B. Final PDF report outline
1. Introduction and context (internship task, scope, not an official portal)
2. Objectives and requirements (use `05-requirements-matrix.md`)
3. Technologies and justification (table of packages and why)
4. System architecture (diagram from `01`, components, trust boundaries)
5. Folder structure and module responsibilities
6. Implementation (config, providers, access control, sessions, routes, frontend, XAMPP page)
7. OAuth 2.0 / OIDC flow (sequence for Google and Microsoft; state, nonce, PKCE)
8. Security decisions (secrets, cookies, fixation, CORS, helmet, no email merge, fail-closed, logging redaction)
9. Testing (method, results table from your executed tests, evidence index)
10. Challenges and resolutions (from your real problem log)
11. Limitations (what was not tested, MemoryStore, no rate limit, dev-only allowlist)
12. Future enhancements (persistent store, SSO groups/roles, CSRF tokens, rate limiting, central logging, deployment)
13. Conclusion
Appendices: route table, env variable list (no values), redacted logs.
Producing the PDF: write in Markdown/Google Docs/Word, export to PDF; or ask Claude (in a short follow-up) to convert your filled outline.

## C. Demo plan (8-10 minutes)
1. (1 min) Architecture slide/diagram and folder tree.
2. (1 min) Show `.env.example` vs git-ignored `.env`; start backend; show startup output.
3. (2 min) React: Google login success → profile; logout.
4. (1 min) Microsoft login success.
5. (1 min) Denied account → Access Denied page → show `auth.log` entry.
6. (1 min) `curl` 401 on `/api/profile`; UI admin check 403.
7. (1 min) XAMPP page doing the same calls.
8. (1 min) Limitations and production path (`docs/06`).
Have fallback screenshots from your own earlier runs if provider consoles are slow.
