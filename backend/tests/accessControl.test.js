process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'x'.repeat(40);
const { test } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const { evaluateGoogle, evaluateMicrosoft, buildSessionUser } = await import('../src/services/accessControl.js');

const gCfg = { allowedDomains: ['example.test'], devAllowedEmails: ['dev@gmail.test'] };
const g = (o) => ({ provider: 'google', subject: '1', email: 'a@example.test', emailVerified: true, hostedDomain: 'example.test', ...o });
const TENANT = '11111111-1111-1111-1111-111111111111';
const mCfg = { tenantId: TENANT };

test('google: allowed domain with matching hd is allowed', () => assert.equal(evaluateGoogle(g(), gCfg).allowed, true));
test('google: other domain is denied', () => assert.equal(evaluateGoogle(g({ email: 'a@other.test', hostedDomain: 'other.test' }), gCfg).reason, 'domain_not_allowed'));
test('google: matching email but missing hd is denied', () => assert.equal(evaluateGoogle(g({ hostedDomain: undefined }), gCfg).reason, 'hosted_domain_mismatch'));
test('google: unverified email is denied', () => assert.equal(evaluateGoogle(g({ emailVerified: false }), gCfg).reason, 'email_unverified'));
test('google: no policy configured fails closed', () => assert.equal(evaluateGoogle(g(), { allowedDomains: [], devAllowedEmails: [] }).reason, 'google_policy_not_configured'));
test('google: dev allowlist email is allowed', () => assert.equal(evaluateGoogle(g({ email: 'dev@gmail.test', hostedDomain: undefined }), gCfg).allowed, true));
test('microsoft: matching tenant allowed', () => assert.equal(evaluateMicrosoft({ subject: 'o', tenantId: TENANT }, mCfg).allowed, true));
test('microsoft: different tenant denied', () => assert.equal(evaluateMicrosoft({ subject: 'o', tenantId: '22222222-2222-2222-2222-222222222222' }, mCfg).reason, 'tenant_mismatch'));
test('microsoft: missing tenant denied', () => assert.equal(evaluateMicrosoft({ subject: 'o' }, mCfg).reason, 'tenant_mismatch'));
test('same email on two providers stays two separate identities', () => {
  const a = buildSessionUser({ provider: 'google', subject: '1', email: 'a@x.test', name: 'A' }, []);
  const b = buildSessionUser({ provider: 'microsoft', subject: '9', email: 'a@x.test', name: 'A' }, []);
  assert.notEqual(a.id, b.id);
});
test('admin role only for provider-qualified match', () => {
  const id = { provider: 'google', subject: '1', email: 'a@x.test', name: 'A' };
  assert.equal(buildSessionUser(id, ['google:a@x.test']).role, 'admin');
  assert.equal(buildSessionUser(id, ['microsoft:a@x.test']).role, 'employee');
});
