// Handlers for protected example resources (run only after requireAuth).
export function profile(req, res) {
  const { name, email, provider, role, providerSubject, tenantId } = req.session.user;
  res.json({ name, email, provider, role, providerSubject, tenantId: tenantId || null });
}

export function protectedExample(req, res) {
  res.json({ message: `Hello ${req.session.user.name || 'employee'}, this data is only for signed-in, authorized users.` });
}

export function adminReport(req, res) {
  res.json({ message: 'Admin-only example report.', generatedAt: new Date().toISOString() });
}
