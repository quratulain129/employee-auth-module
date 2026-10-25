# Employee Authentication Module (Prototype)

Google + Microsoft Entra ID sign-in with organization restrictions, server-side sessions, protected APIs and auth logging.
**Status:** code generated and syntax-checked only. It has NOT been run end to end: you must install, configure real provider apps and execute `docs/02-test-plan.md` yourself.

Stack: Node 20+, Express, passport-google-oauth20, @azure/msal-node, express-session, helmet, cors, dotenv, winston | React + Vite | XAMPP (HTML test page only).

## 0. Central reference (use these exact values everywhere)

| Item | Value |
|---|---|
| Backend URL / port | `http://localhost:5000` (never mix with `127.0.0.1`) |
| React frontend | `http://localhost:5173` |
| XAMPP test page | `http://localhost/pl-auth-test/auth-test.html` |
| Google callback (register in Google Cloud) | `http://localhost:5000/auth/google/callback` |
| Microsoft redirect URI (register in Entra, platform **Web**) | `http://localhost:5000/auth/microsoft/callback` |
| Backend env file | `backend/.env` (copy from `backend/.env.example`) |
| Log file | `backend/logs/auth.log` |
| Session cookie name | `pl_auth.sid` |

| Command (run from) | Purpose |
|---|---|
| `cd backend && npm install` | install backend dependencies |
| `cd backend && npm test` | run automated tests (no real provider needed) |
| `cd backend && npm run dev` | start backend with auto-restart |
| `cd frontend && npm install && npm run dev` | start React app |
| `tail -f backend/logs/auth.log` | watch auth events live |

## 1. Folder structure

```
employee-auth-module/
├── README.md  .gitignore
├── backend/
│   ├── package.json  .env.example
│   ├── logs/                      (auth.log is created here; git-ignored)
│   ├── src/
│   │   ├── server.js              starts the HTTP server
│   │   ├── app.js                 builds the Express app (security headers, CORS, session, routes)
│   │   ├── config/                env.js (validated settings), session.js (cookie + session rules)
│   │   ├── routes/                authRoutes.js (/auth/*), apiRoutes.js (/api/*)
│   │   ├── controllers/           authController.js (login flow), apiController.js (protected data)
│   │   ├── middleware/            requireAuth.js (401/403 gatekeepers), errorHandler.js
│   │   ├── services/              accessControl.js (authorization rules), identity.js (profile normalizing), logger.js
│   │   └── providers/             google.js (passport), microsoft.js (MSAL)  <- all provider-specific code
│   └── tests/                     accessControl.test.js, api.test.js
├── frontend/                      Vite + React (api/, auth/, components/, pages/)
├── xampp-test/auth-test.html      standalone test page
└── docs/                          01 architecture+quiz, 02 test plan, 03 documentation+report+demo, 04 interview, 05 matrix, 06 production
```

## 2. Stage-by-stage setup (do in this order)

### Stage 1: Tools (Terminal in Cursor: Terminal > New Terminal)
```bash
node -v      # need v20 or newer
npm -v
git --version
```
If `node` is missing: download the LTS installer from https://nodejs.org and reopen Cursor. If `git` is missing, macOS offers to install Xcode Command Line Tools; accept.
Document: versions, screenshot of the three outputs.

### Stage 2: Open project, install backend
```bash
cd employee-auth-module
git init
cd backend
npm install
npm test
```
Expected: `npm test` shows all tests passing (they need no provider credentials). If a test fails, copy the failing test name and message; do not edit tests to force a pass.

### Stage 3: Configure `.env` (no provider yet)
```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Open `backend/.env`, paste the printed value after `SESSION_SECRET=`. Leave other `REPLACE_WITH...` values for now.
```bash
npm run dev
```
Expected: "Auth backend running at http://localhost:5000", Google/Microsoft "NOT configured". In another terminal: `curl http://localhost:5000/health` -> `{"status":"ok"}`.
Verify the guard: `curl -i http://localhost:5000/api/profile` -> `401`.

### Stage 4: Frontend
```bash
cd ../frontend
cp .env.example .env
npm install
npm run dev
```
Open http://localhost:5173 . Expected: Sign-in page; clicking a button shows "not configured" until Stage 5/6.

### Stage 5: Google provider (browser: https://console.cloud.google.com)
1. Create/select a project (a personal project is fine for development).
2. APIs & Services > OAuth consent screen (may be labelled "Google Auth Platform"): choose **Internal** only if you are inside a Google Workspace organization; otherwise **External** in *Testing* mode and add your test accounts as Test users.
3. Credentials > Create credentials > OAuth client ID > Web application. Under **Authorized redirect URIs** add exactly `http://localhost:5000/auth/google/callback`.
4. Copy Client ID and Client secret into `backend/.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`). Never paste the secret into chat or screenshots.
5. Policy: personal Gmail accounts have no organization domain. For development set `DEV_ALLOWED_EMAILS=your.test@gmail.com`. For the real company, set `ALLOWED_GOOGLE_DOMAINS` **only after IT confirms the domain** and that it is a Google Workspace domain.
6. Restart backend (`Ctrl+C`, `npm run dev`). Test with http://localhost:5173 .

### Stage 6: Microsoft provider (browser: https://entra.microsoft.com)
You need a directory where you may register apps. If you cannot, ask Packages IT, or use a free Azure account / Microsoft 365 developer sandbox as a separate development tenant (availability varies).
1. Identity > Applications > App registrations > New registration. Name it e.g. `employee-auth-dev`. Supported account types: **this organizational directory only (single tenant)**. Redirect URI: platform **Web**, `http://localhost:5000/auth/microsoft/callback`.
2. On the Overview page copy **Application (client) ID** -> `MS_CLIENT_ID` and **Directory (tenant) ID** -> `MS_TENANT_ID`.
3. Certificates & secrets > New client secret > copy the **Value** immediately (shown once) -> `MS_CLIENT_SECRET`.
4. Restart backend. Startup should now show Microsoft "configured".
Tenant ID and client ID are identifiers (not secret, but do not publish needlessly). Client secret and session secret are confidential.

### Stage 7: XAMPP test page
1. Install XAMPP for macOS if needed (https://www.apachefriends.org). Open XAMPP > **Manage Servers** > start **Apache** only (MySQL not needed).
2. Create folder `/Applications/XAMPP/xamppfiles/htdocs/pl-auth-test/` and copy `xampp-test/auth-test.html` into it:
```bash
mkdir -p /Applications/XAMPP/xamppfiles/htdocs/pl-auth-test
cp xampp-test/auth-test.html /Applications/XAMPP/xamppfiles/htdocs/pl-auth-test/   # run from project root
```
3. Start the Express backend separately (`npm run dev`). XAMPP does not run Node.
4. Open `http://localhost/pl-auth-test/auth-test.html` (if Apache uses another port, e.g. 8080, set `XAMPP_TEST_URL` in `.env` to that exact URL and restart the backend).
How it works: the page is served from origin `http://localhost`; the backend is origin `http://localhost:5000`. Different port = different **origin** (CORS applies) but the same **site** (cookies are shared by host, and `SameSite=Lax` allows them). The backend allows that one origin with `credentials: true`; the page uses `fetch(..., {credentials:'include'})`. Login is a normal browser redirect with `?client=xampp` so the backend returns to this page with `?result=...`.

### Stage 8: Test and record evidence
Follow `docs/02-test-plan.md`, and the checklist in `docs/03-...`.

## 3. Route table

| Method | Path | Purpose | Auth? | Expected behavior |
|---|---|---|---|---|
| GET | `/health` | liveness check | No | 200 `{status:'ok'}` |
| GET | `/auth/google` | start Google login (browser navigation) | No | 302 to Google, or to login page with `error=provider_not_configured` |
| GET | `/auth/google/callback` | Google redirects here | No | success: new session + 302 to `/profile`; denied: 302 `/access-denied`; failure: 302 `/login?error=...` |
| GET | `/auth/microsoft` | start Microsoft login | No | 302 to Microsoft |
| GET | `/auth/microsoft/callback` | Microsoft redirects here | No | same outcomes as Google |
| GET | `/auth/session` | is there a valid session? | No (reports status) | 200 `{authenticated:true,user}` or `{authenticated:false,reason}` |
| POST | `/auth/logout` | destroy session | No (idempotent) | 200 `{ok:true}`, cookie cleared |
| GET | `/api/profile` | current user profile | Yes | 200 profile, or 401 |
| GET | `/api/protected/example` | protected sample | Yes | 200 message, or 401 |
| GET | `/api/admin/report` | role-protected sample | Yes + admin role | 200, or 401 (no session), or 403 (not admin) |

Method choices: login/callback are GET because browsers *navigate* to them and providers redirect with GET; logout is POST because it changes state and must not be triggerable by a simple link or image.

## 4. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Server exits: `SESSION_SECRET is missing` | do Stage 3 step 2 |
| Google page: `redirect_uri_mismatch` | console URI differs from `http://localhost:5000/auth/google/callback` (scheme, port, path, trailing slash, `127.0.0.1`) |
| Google: `access_denied` / app not verified | External app in Testing: add your account under Test users |
| Microsoft `AADSTS50011` | redirect URI mismatch or wrong platform type (use Web) |
| Microsoft `AADSTS700016` / `AADSTS7000215` | wrong client ID / wrong secret (use secret *Value*, not Secret ID) |
| Login works but profile page bounces to login | cookie not stored: mixing `localhost` and `127.0.0.1`, or `BACKEND_URL` mismatch |
| Browser console shows CORS error on XAMPP page | `XAMPP_TEST_URL` origin differs from the URL you opened; fix `.env`, restart |
| Always "Access denied" | no `ALLOWED_GOOGLE_DOMAINS`/`DEV_ALLOWED_EMAILS` set, or `MS_TENANT_ID` differs from the account's tenant; check `auth.log` `reason` field |
| Sessions vanish after restart | expected: in-memory store (see `docs/06`) |

## 5. Limitations (honest list)
Not executed end to end by the author; MemoryStore sessions; no CSRF token beyond SameSite+CORS+POST logout; no rate limiting; file logging only; Google `hd` behaviour must be verified with a real Workspace account; Microsoft e-mail claim may be absent (UPN is used for display only). See `docs/06`.
