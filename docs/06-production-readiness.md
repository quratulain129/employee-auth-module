# 06. Prototype vs production, and what Packages Limited IT must approve

| Area | Prototype (this repo) | Production needs |
|---|---|---|
| Sessions | in-memory store, lost on restart, single process | persistent shared store (e.g. Redis), session TTL policy |
| Transport | `http://localhost` | HTTPS everywhere; `NODE_ENV=production`; `TRUST_PROXY=true` behind a proxy; cookies `secure` |
| Identity config | dev allowlist (`DEV_ALLOWED_EMAILS`), personal test accounts | company-approved Google Workspace domain(s) and Entra tenant ID; dev allowlist disabled |
| Secrets | local `.env` | secret manager / vault; rotation; separate dev and prod registrations |
| Callbacks | `localhost:5000` URLs | approved production domain registered in Google/Entra; remove localhost URIs |
| Logging | local JSON file, 5 MB rotation | central log platform, retention policy, access control, alerting, privacy review |
| Hardening | helmet, CORS allowlist, SameSite | rate limiting, CSRF tokens if cookies are used cross-site, dependency scanning, security review |
| Access policy | optional `ADMIN_USERS` | group/role mapping, admin consent, conditional access, MFA policy |
| Operations | `npm run dev` | deployment pipeline, monitoring, backups, ownership |

IT/security questions to ask: Which Google Workspace domain(s) and Entra tenant ID are authoritative? May interns/apps register OAuth apps, and who owns them? Allowed callback hosts? Required scopes/consent? Secret storage standard? Log retention and who may read logs? Hosting and approved branding?
Personal Google/Microsoft accounts are not equivalent to approved employee identities; use them only for development tests.
Official docs to cite: Google Identity (OpenID Connect / Web server OAuth), Microsoft identity platform (auth code flow, MSAL Node), OWASP Session Management Cheat Sheet.
