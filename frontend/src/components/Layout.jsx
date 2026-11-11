import { Link, useLocation, useNavigate } from 'react-router-dom';
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
        <div className="topbar-left">
          <Link to="/profile" className="brand-link">
            <span className="brand-mark" aria-hidden="true" />
            <span className="brand-title">Employee Portal</span>
          </Link>
          {status === 'authenticated' && (
            <nav className="nav-links" aria-label="Portal Navigation">
              <Link
                to="/profile"
                className={`nav-item ${pathname === '/profile' ? 'active' : ''}`}
              >
                Profile
              </Link>
              <Link
                to="/tools/cap-detection"
                className={`nav-item ${pathname.startsWith('/tools/cap-detection') ? 'active' : ''}`}
              >
                🧢 Cap Detection Tool
              </Link>
            </nav>
          )}
        </div>

        {status === 'authenticated' && (
          <div className="who">
            <span className="who-name">{user.name || user.email}</span>
            <button className="btn btn-quiet" onClick={signOut}>Sign out</button>
          </div>
        )}
      </header>
      <main className="page">{children}</main>
      <footer className="footer">Internal development prototype.</footer>
    </div>
  );
}
