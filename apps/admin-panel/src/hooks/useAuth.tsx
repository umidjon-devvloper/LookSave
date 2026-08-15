import type { AuthUser } from '@looksave/shared-types';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { clearTokens, login as apiLogin, logout as apiLogout, restoreSession } from '../api/client';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  signIn: (phone: string, password: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void restoreSession().then((restored) => {
      if (!active) return;
      setUser(restored);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      signIn: async (phone, password) => {
        const signedIn = await apiLogin(phone, password);
        setUser(signedIn);
        return signedIn;
      },
      signOut: async () => {
        await apiLogout();
        clearTokens();
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth faqat AuthProvider ichida ishlaydi');
  return context;
}
