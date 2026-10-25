process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'x'.repeat(40);
process.env.SESSION_ABSOLUTE_HOURS = '1';
for (const k of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'MS_CLIENT_ID', 'MS_CLIENT_SECRET', 'MS_TENANT_ID']) delete process.env[k];
const { test } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const request = (await import('supertest')).default;
const { createApp } = await import('../src/app.js');

const app = createApp();
const employee = { name: 'Test User', email: 'test@example.test', provider: 'google', role: 'employee', providerSubject: '1' };
const admin = { ...employee, role: 'admin' };
const login = async (user, ageMs) => {
  const agent = request.agent(app);
  await agent.post('/__test/login').send({ user, ageMs }).expect(200);
  return agent;
};

test('health endpoint is public', async () => { await request(app).get('/health').expect(200); });
test('protected API without session -> 401', async () => { await request(app).get('/api/profile').expect(401); });
test('session status without login -> authenticated:false', async () => {
  const res = await request(app).get('/auth/session').expect(200);
  assert.equal(res.body.authenticated, false);
});
test('valid session -> profile 200 with provider and email', async () => {
  const a = await login(employee);
  const res = await a.get('/api/profile').expect(200);
  assert.equal(res.body.provider, 'google');
  assert.equal(res.body.email, 'test@example.test');
});
test('authenticated non-admin on admin route -> 403', async () => { await (await login(employee)).get('/api/admin/report').expect(403); });
test('admin on admin route -> 200', async () => { await (await login(admin)).get('/api/admin/report').expect(200); });
test('session older than absolute lifetime -> 401 session_expired', async () => {
  const a = await login(employee, 2 * 60 * 60 * 1000);
  const res = await a.get('/api/profile').expect(401);
  assert.equal(res.body.error, 'session_expired');
});
test('logout destroys the session', async () => {
  const a = await login(employee);
  await a.post('/auth/logout').expect(200);
  await a.get('/api/profile').expect(401);
});
test('unconfigured provider redirects to login with an error code', async () => {
  const res = await request(app).get('/auth/google').expect(302);
  assert.match(res.headers.location, /\/login\?error=provider_not_configured/);
});
test('CORS: unknown origin gets no allow-origin header', async () => {
  const res = await request(app).get('/health').set('Origin', 'http://evil.test');
  assert.equal(res.headers['access-control-allow-origin'], undefined);
});
test('CORS: frontend origin is allowed with credentials', async () => {
  const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');
  assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
  assert.equal(res.headers['access-control-allow-credentials'], 'true');
});
test('unknown route -> JSON 404', async () => { await request(app).get('/nope').expect(404); });
