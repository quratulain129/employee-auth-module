# 02. Test plan and results template

Rule: write "PASS/FAIL" only after you ran the test. Leave "NOT RUN" until then. Redact secrets, full tokens, cookie values and unrelated personal data in screenshots.

## A. Automated (no provider accounts needed): `cd backend && npm test`
Covers: access-control rules (domain, `hd`, tenant, dev allowlist, no merge-by-email, role by provider-qualified key), 401 without session, 200 with session, 403 non-admin, 200 admin, absolute expiry 401, logout invalidation, unconfigured provider handling, CORS allow/deny, JSON 404.
Evidence: terminal screenshot of the summary (pass/fail counts). Failure: any `not ok` line.

## B. Manual/real-account tests
Start backend + frontend first. `$B` = `http://localhost:5000`.

| ID | What to do / command | Expected | Failure looks like | Evidence |
|---|---|---|---|---|
| T01 Google allowed account | Add test email to `DEV_ALLOWED_EMAILS` (or real domain after IT approval), restart, click Sign in with Google | Lands on Profile showing name, email, "Google" | Access denied or error banner | Screenshot of profile; `auth.log` LOGIN_SUCCESS line |
| T02 Google disallowed account | Sign in with another Google account not in policy | Access Denied page, no session (`curl -b` not needed: check `/auth/session` in browser shows `authenticated:false`) | Profile page appears | Screenshot; ACCESS_DENIED line with reason |
| T03 Microsoft correct tenant | Click Sign in with Microsoft, use account from `MS_TENANT_ID` directory | Profile shows "Microsoft Entra ID" | AADSTS error or denied | Screenshot; LOGIN_SUCCESS |
| T04 Microsoft other tenant | Use account from a different tenant/personal account (only if available) | Microsoft rejects at sign-in (single-tenant app) or `tenant_mismatch` denial | Profile page appears | Screenshot; error text or log line |
| T05 Cancellation | On provider consent screen press Cancel/deny | Login page with "cancelled" message | Blank page / server error | Screenshot; AUTH_FAILURE reason `cancelled` |
| T06 Callback mismatch | Temporarily change the registered redirect URI in the console to a wrong value, try login, then **restore it** | Provider shows redirect mismatch error | Login succeeds | Screenshot (redact IDs); note what you changed and restored |
| T07 Session created | After T01: DevTools > Application > Cookies > `localhost` | Cookie `pl_auth.sid`, HttpOnly ✓, SameSite Lax, Secure ✗ (local http) | No cookie | Screenshot (hide value) |
| T08 No session → protected | `curl -i $B/api/profile` | `401` JSON `unauthenticated` | 200 | Terminal output |
| T09 Valid session → protected | Browser: open `$B/api/profile` while signed in | `200` profile JSON | 401 | Screenshot |
| T10 Role check | In UI press "Request admin report" as non-admin; then add `ADMIN_USERS=google:your@email`, restart, sign in again | 403 first, 200 after | 200 for non-admin | Screenshots of both |
| T11 Idle expiry | Set `SESSION_IDLE_MINUTES=1`, restart, sign in, wait 90 s, reload/press a button | Redirect to login with "session expired" | Still signed in | Screenshot; note setting |
| T12 Logout | Click Sign out, then `GET $B/api/profile` in browser | Login page; profile API 401; log LOGOUT | Still 200 | Screenshots; LOGOUT line |
| T13 Reuse old cookie after logout | Copy cookie before logout (DevTools), logout, send old value: `curl -i -H "Cookie: pl_auth.sid=PASTE" $B/api/profile` | `401` | 200 | Output with cookie redacted |
| T14 Direct API bypass | `curl -i $B/api/admin/report` and with forged `-H "Cookie: pl_auth.sid=abc"` | `401` both | 200 | Terminal output |
| T15 Logging | `cat backend/logs/auth.log` after T01-T05 | JSON lines: timestamp, event, provider, masked user, reason; no tokens/codes/session IDs | Full emails, tokens, cookie values in log | Redacted log excerpt |
| T16 Config errors | Remove `SESSION_SECRET`, run `npm run dev` | Process exits with clear message, no secret printed | Server starts | Terminal screenshot; then restore |
| T17 Unconfigured provider | Leave Microsoft vars as placeholders; click Microsoft | Login page "not configured" | Crash / stack trace | Screenshot |
| T18 XAMPP flow | Open XAMPP page, sign in via both buttons, click each API button, logout | Banner shows result; responses match T08-T12; no CORS errors | Console CORS error | Screenshots incl. console |
| T19 Secret hygiene | `git status` and `git check-ignore -v backend/.env`; search build: `grep -r "GOCSPX\|client_secret" frontend/src` | `.env` ignored; no secret in frontend | `.env` listed as untracked/staged | Terminal output |

## C. Results template
| ID | Date | Tester | Environment | Result (NOT RUN/PASS/FAIL) | Evidence file | Notes |
|---|---|---|---|---|---|---|
