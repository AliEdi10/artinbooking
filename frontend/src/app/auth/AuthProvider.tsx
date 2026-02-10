'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { parseToken } from './tokenUtils';

export type AuthUser = {
  email?: string;
  role?: string;
  schoolId?: number;
  name?: string;
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  setToken: (token: string | null) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = window.localStorage.getItem('idToken');
    if (storedToken) {
      const parsedUser = parseToken(storedToken);
      if (parsedUser) {
        setTokenState(storedToken);
        setUser(parsedUser);
      } else {
        window.localStorage.removeItem('idToken');
      }
    }
    setLoading(false);
  }, []);

  const setToken = (newToken: string | null) => {
    if (newToken) {
      const parsedUser = parseToken(newToken);
      if (!parsedUser) {
        window.localStorage.removeItem('idToken');
        setTokenState(null);
        setUser(null);
        return;
      }

      window.localStorage.setItem('idToken', newToken);
      setTokenState(newToken);
      setUser(parsedUser);
    } else {
      window.localStorage.removeItem('idToken');
      setTokenState(null);
      setUser(null);
    }
  };

  const signOut = () => setToken(null);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      setToken,
      signOut,
    }),
    [loading, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
