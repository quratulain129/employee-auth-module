import { Link, useSearchParams } from 'react-router-dom';
import { DENIED_REASONS } from '../auth/messages.js';

export default function AccessDeniedPage() {
  const [params] = useSearchParams();
  const reason = params.get('reason');
  return (
    <section className="card denied" aria-labelledby="denied-title">
      <div className="denied-icon" aria-hidden="true">!</div>
      <h1 id="denied-title">Access denied</h1>
      <p>Your account signed in successfully, but it is not approved to use this application.</p>
      <p className="muted">{DENIED_REASONS[reason] || 'Your account does not meet the access requirements.'}</p>
      <p className="muted">No session was created. If you believe this is a mistake, contact your IT support team.</p>
      <Link className="btn btn-primary" to="/login">Back to sign in</Link>
    </section>
  );
}
