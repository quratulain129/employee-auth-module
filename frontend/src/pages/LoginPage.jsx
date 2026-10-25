import { Navigate, useSearchParams } from 'react-router-dom';
import { loginUrl } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { LOGIN_ERRORS } from '../auth/messages.js';
import { Alert, Spinner } from '../components/Feedback.jsx';

export default function LoginPage() {
  const { status, expired } = useAuth();
  const [params] = useSearchParams();
  const error = params.get('error');

  if (status === 'loading') return <Spinner label="Checking your session…" />;
  if (status === 'authenticated') return <Navigate to="/profile" replace />;

  // Full-page navigation: the browser must visit the provider, where the email and password are entered.
  function go(provider) {
    window.location.assign(loginUrl(provider));
  }

  return (
    <div className="login">
      <aside className="login-art" aria-hidden="true">
        <div className="login-art-copy">
          <p className="login-art-title">One sign-in for every internal tool.</p>
          <p className="login-art-sub">Use your organization account. Your password stays with Google or Microsoft and never reaches this application.</p>
        </div>
      </aside>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-box">
          <h1 id="login-title">Sign in</h1>
          <p className="muted">Access is limited to approved employees.</p>

          {expired && <Alert kind="warn" title="Your session expired">You were signed out after a period of inactivity. Please sign in again.</Alert>}
          {error && <Alert kind="error" title="Sign-in problem">{LOGIN_ERRORS[error] || 'Sign-in failed. Please try again.'}</Alert>}
          {status === 'error' && <Alert kind="error" title="Cannot reach the server">Make sure the backend is running.</Alert>}

          <div className="stack">
            <button type="button" className="btn btn-provider" onClick={() => go('google')}>
              <span className="mark mark-google" aria-hidden="true">G</span>Continue with Google
            </button>
            <button type="button" className="btn btn-provider" onClick={() => go('microsoft')}>
              <span className="mark mark-ms" aria-hidden="true"><i /><i /><i /><i /></span>Continue with Microsoft
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}