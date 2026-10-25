// UX convenience only. Real protection is the backend's requireAuth middleware.
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { Alert, Spinner } from '../components/Feedback.jsx';

export default function ProtectedRoute({ children }) {
  const { status, refresh } = useAuth();
  if (status === 'loading') return <Spinner label="Checking your session…" />;
  if (status === 'error') {
    return (
      <Alert kind="error" title="Cannot reach the server">
        Make sure the backend is running, then <button className="link" onClick={refresh}>try again</button>.
      </Alert>
    );
  }
  if (status === 'unauthenticated') return <Navigate to="/login" replace />;
  return children;
}
