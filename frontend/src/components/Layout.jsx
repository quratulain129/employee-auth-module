import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Layout({ children }) {
  const { status, user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const signOut = async () => { await logout(); navigate('/login'); };

  // The sign-in screen is full-bleed and draws its own layout.
  if (pathname === '/login') return children;

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand"><span className="brand-mark" aria-hidden="true" />Employee sign-in module</span>
        {status === 'authenticated' && (
          <div className="who">
            <span className="who-name">{user.name || user.email}</span>
            <button className="btn btn-quiet" onClick={signOut}>Sign out</button>
          </div>
        )}
      </header>
      <main className="page">{children}</main>
      <footer className="footer">Internal development prototype. Not an official Packages Limited portal.</footer>
    </div>
  );
}
