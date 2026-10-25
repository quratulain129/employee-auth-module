import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client.js';

const AuthContext = createContext(null);
const FLAG = 'pl_was_signed_in'; // non-sensitive hint so we can say "your session expired" instead of "please sign in"

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null, expired: false });

  const refresh = useCallback(async () => {
    try {
      const { data } = await apiFetch('/auth/session');
      if (data?.authenticated) {
        sessionStorage.setItem(FLAG, '1');
        setState({ status: 'authenticated', user: data.user, expired: false });
      } else {
        const expired = sessionStorage.getItem(FLAG) === '1';
        sessionStorage.removeItem(FLAG);
        setState({ status: 'unauthenticated', user: null, expired });
      }
    } catch {
      setState({ status: 'error', user: null, expired: false });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const logout = useCallback(async () => {
    await apiFetch('/auth/logout', { method: 'POST' });
    sessionStorage.removeItem(FLAG);
    setState({ status: 'unauthenticated', user: null, expired: false });
  }, []);

  const markExpired = useCallback(() => {
    sessionStorage.removeItem(FLAG);
    setState({ status: 'unauthenticated', user: null, expired: true });
  }, []);

  const value = useMemo(() => ({ ...state, refresh, logout, markExpired }), [state, refresh, logout, markExpired]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
