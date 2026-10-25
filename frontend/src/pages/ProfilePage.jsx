import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Alert, Spinner } from '../components/Feedback.jsx';

export default function ProfilePage() {
  const { markExpired } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  // One helper for every protected call: a 401 means the server no longer recognises the session.
  async function call(path) {
    const res = await apiFetch(path);
    if (res.status === 401) { markExpired(); navigate('/login'); }
    return res;
  }

  useEffect(() => {
    let alive = true;
    call('/api/profile').then((res) => {
      if (!alive) return;
      if (res.ok) setProfile(res.data); else if (res.status !== 401) setError('Could not load your profile.');
    }).catch(() => alive && setError('Cannot reach the server.'));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  if (error) return <Alert kind="error" title="Something went wrong">{error}</Alert>;
  if (!profile) return <Spinner label="Loading your profile…" />;

  const initial = (profile.name || profile.email || '?').trim().charAt(0).toUpperCase();
  const providerLabel = profile.provider === 'google' ? 'Google' : 'Microsoft Entra ID';

  return (
    <>
      <section className="card profile-head" aria-labelledby="profile-title">
        <div className="avatar" aria-hidden="true">{initial}</div>
        <div>
          <h1 id="profile-title">{profile.name || 'Signed-in user'}</h1>
          <p className="muted">{profile.email || 'No email returned'}</p>
          <p className="badges">
            <span className="badge">{providerLabel}</span>
            <span className="badge badge-role">{profile.role}</span>
          </p>
        </div>
      </section>
    </>
  );
}
