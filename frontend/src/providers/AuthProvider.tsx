import { useState, useEffect, useCallback, ReactNode } from 'react';
import { REFRESH_TOKEN_KEY, TOKEN_KEY } from './authConstants';
import { AuthContext, type AuthContextType } from './AuthContext';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'EMPLOYER' | 'EMPLOYEE';
  picture?: string;
}

interface JwtPayload {
  sub?: string;
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  picture?: string;
  exp?: number;
}

function decodeJwtPayload(token: string): User | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    const decoded = atob(parts[1]);
    const payload = JSON.parse(decoded) as JwtPayload;
    return {
      id: payload.sub ?? payload.id ?? '',
      email: payload.email ?? '',
      name: payload.name ?? '',
      role: payload.role === 'EMPLOYER' || payload.role === 'EMPLOYEE' ? payload.role : 'EMPLOYEE',
      picture: payload.picture,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isRefreshingSession, setIsRefreshingSession] = useState(false);

  const backendUrl = (import.meta.env.VITE_BACKEND_URL as string) || 'http://localhost:4000';

  const getTokenExpiryMs = useCallback((jwtToken: string | null): number | null => {
    if (!jwtToken) return null;
    try {
      const payloadPart = jwtToken.split('.')[1];
      if (!payloadPart) return null;
      const payload = JSON.parse(atob(payloadPart)) as JwtPayload;
      if (!payload.exp) return null;
      return payload.exp * 1000;
    } catch {
      return null;
    }
  }, []);

  // Initialize from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (stored) {
      const decoded = decodeJwtPayload(stored);
      if (decoded) {
        setToken(stored);
        setUser(decoded);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    }
    if (storedRefresh) setRefreshToken(storedRefresh);
    setIsLoading(false);
  }, []);

  const login = useCallback((provider: 'google' | 'github') => {
    const backendUrl = (import.meta.env.VITE_BACKEND_URL as string) || 'http://localhost:4000';
    window.location.href = `${backendUrl}/auth/${provider}`;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    window.location.href = '/login';
  }, []);

  const setTokenFromCallback = useCallback((newToken: string, newRefreshToken?: string | null) => {
    const decoded = decodeJwtPayload(newToken);
    if (decoded) {
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      setUser(decoded);
      if (newRefreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
        setRefreshToken(newRefreshToken);
      }
    }
  }, []);

  const refreshSession = useCallback(async () => {
    if (!refreshToken) {
      logout();
      return;
    }

    setIsRefreshingSession(true);
    try {
      const response = await fetch(`${backendUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Session refresh failed');
      }

      const payload = (await response.json()) as { accessToken?: string };
      if (!payload.accessToken) {
        throw new Error('Missing access token in refresh response');
      }

      setTokenFromCallback(payload.accessToken);
      setShowExpiryWarning(false);
    } catch {
      logout();
    } finally {
      setIsRefreshingSession(false);
    }
  }, [backendUrl, logout, refreshToken, setTokenFromCallback]);

  useEffect(() => {
    if (!token) {
      setShowExpiryWarning(false);
      setSecondsLeft(0);
      return;
    }

    const tick = () => {
      const expiryMs = getTokenExpiryMs(token);
      if (!expiryMs) return;

      const remainingMs = expiryMs - Date.now();
      const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
      setSecondsLeft(remainingSeconds);

      if (remainingMs <= 0) {
        logout();
        return;
      }

      setShowExpiryWarning(remainingMs <= 2 * 60 * 1000);
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [getTokenExpiryMs, logout, token]);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    logout,
    setTokenFromCallback,
  };

  return (
    <AuthContext value={value}>
      {children}
      {showExpiryWarning ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-hi bg-[var(--surface)] p-6 shadow-[var(--shadow-lg)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
              Session timeout warning
            </p>
            <h3 className="mt-2 text-xl font-black text-[var(--text)]">
              You are about to be signed out
            </h3>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Your session will expire in {secondsLeft}s. Stay signed in to continue securely.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={logout}
                className="rounded-xl border border-hi px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
              >
                Sign out now
              </button>
              <button
                type="button"
                onClick={() => {
                  void refreshSession();
                }}
                disabled={isRefreshingSession}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--bg)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isRefreshingSession ? 'Refreshing…' : 'Stay logged in'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AuthContext>
  );
}

export default AuthContext;
