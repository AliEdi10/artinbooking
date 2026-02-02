'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../auth/AuthProvider';

// Type declaration for Google Sign-In API
declare global {
  interface Window {
    google?: {
      accounts?: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          renderButton: (element: HTMLElement, config: {
            theme: string;
            size: string;
            text?: string;
          }) => void;
        };
      };
    };
  }
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

// Seeded user accounts from database - identity_subject must match DB exactly
const DEV_USERS = [
  { email: 'superadmin@example.com', sub: 'superadmin-google-sub', role: 'SUPERADMIN', schoolId: null, label: 'Super Admin', color: 'bg-purple-600 hover:bg-purple-700' },
  { email: 'admin@brightside.test', sub: 'brightside-admin-sub', role: 'SCHOOL_ADMIN', schoolId: 100, label: 'School Admin (Brightside)', color: 'bg-blue-600 hover:bg-blue-700' },
  { email: 'driver@brightside.test', sub: 'brightside-driver-sub', role: 'DRIVER', schoolId: 100, label: 'Instructor (Dana)', color: 'bg-green-600 hover:bg-green-700' },
  { email: 'student@brightside.test', sub: 'brightside-student-sub', role: 'STUDENT', schoolId: 100, label: 'Student (Sam)', color: 'bg-orange-600 hover:bg-orange-700' },
  { email: 'alex@brightside.test', sub: 'brightside-alex-sub', role: 'STUDENT', schoolId: 100, label: 'Student (Alex)', color: 'bg-pink-600 hover:bg-pink-700' },
];

export default function LoginPage() {
  const { token, setToken } = useAuth();
  const [googleReady, setGoogleReady] = useState(false);
  const [status, setStatus] = useState('Sign in with Google or use a dev account below.');
  const [localToken, setLocalToken] = useState('');
  const [loadingUser, setLoadingUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (token) {
      router.replace('/');
    }
  }, [router, token]);

  useEffect(() => {
    if (googleReady) return;

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      // Only show this message in dev mode
      if (process.env.NEXT_PUBLIC_DEV_MODE === 'true') {
        setStatus('Google Sign-In not configured. Use email/password or dev accounts.');
      } else {
        setStatus('Sign in with your email and password.');
      }
      return;
    }

    const initializeGoogle = () => {
      if (!window.google?.accounts?.id || !buttonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential?: string }) => {
          if (!response.credential) return;
          setToken(response.credential);
          router.replace('/');
        },
        use_fedcm_for_prompt: true,
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
      });

      setGoogleReady(true);
    };

    if (window.google?.accounts?.id) {
      initializeGoogle();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = initializeGoogle;
    document.head.appendChild(script);

    return () => {
      script.onload = null;
      document.head.removeChild(script);
    };
  }, [googleReady, router, setToken]);

  const handleLocalSubmit = () => {
    if (!localToken.trim()) {
      setError('Please enter a JWT token');
      return;
    }
    const parts = localToken.trim().split('.');
    if (parts.length !== 3) {
      setError('Invalid JWT format. Token must have 3 parts (header.payload.signature)');
      return;
    }
    setError(null);
    setToken(localToken.trim());
    router.replace('/');
  };

  const handleDevLogin = async (user: typeof DEV_USERS[0]) => {
    setLoadingUser(user.email);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/auth/local-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sub: user.sub,
          email: user.email,
          role: user.role,
          drivingSchoolId: user.schoolId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to get token: ${response.status}`);
      }

      const data = await response.json();
      if (!data.token) {
        throw new Error('No token in response');
      }

      setToken(data.token);
      router.replace('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to login';
      setError(message);
      console.error('Dev login failed:', err);
    } finally {
      setLoadingUser(null);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white border border-slate-200 rounded-lg shadow p-6 w-full max-w-lg space-y-4">
        <div className="space-y-2 text-center">
          <img src="/logo.png" alt="Artin Driving School" className="h-16 w-16 mx-auto" />
          <h1 className="text-xl font-semibold text-slate-900">Artin Driving School</h1>
          <p className="text-sm text-slate-600">{status}</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={async (e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const email = formData.get('email');
          const password = formData.get('password');
          if (!email || !password) return;

          setLoadingUser('password-login');
          setError(null);
          try {
            const response = await fetch(`${BACKEND_URL}/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
              const data = await response.json();
              throw new Error(data.error || 'Login failed');
            }

            const data = await response.json();
            setToken(data.token);
            router.replace('/');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
          } finally {
            setLoadingUser(null);
          }
        }} className="space-y-4 border-b pb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input name="email" type="email" required className="w-full border rounded p-2 text-slate-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input name="password" type="password" required className="w-full border rounded p-2 text-slate-900" />
            <div className="mt-1 text-right">
              <a href="/login/forgot-password" className="text-sm text-blue-600 hover:text-blue-800">
                Forgot password?
              </a>
            </div>
          </div>
          <button
            type="submit"
            disabled={loadingUser === 'password-login'}
            className="w-full bg-blue-600 text-white rounded py-3 min-h-[44px] font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loadingUser === 'password-login' ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* Dev Login Accounts - only shown in dev mode */}
        {process.env.NEXT_PUBLIC_DEV_MODE === 'true' && (
          <div className="border-2 border-emerald-200 bg-emerald-50 rounded p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-emerald-800">🚀 Development Accounts</p>
              <p className="text-xs text-emerald-600">Click to login as any role (dev mode only)</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEV_USERS.map((user) => (
                <button
                  key={user.email}
                  type="button"
                  onClick={() => handleDevLogin(user)}
                  disabled={loadingUser !== null}
                  className={`text-sm font-medium text-white rounded py-3 px-3 min-h-[44px] ${user.color} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                >
                  {loadingUser === user.email ? 'Logging in...' : user.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-emerald-600">
              Accounts are seeded from the database. Each role has its own portal view.
            </p>
          </div>
        )}

        {/* Only show Google Sign-In section if configured */}
        {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
          <div className="flex items-center justify-between border rounded p-3 bg-slate-50">
            <div>
              <p className="text-sm font-medium text-slate-800">Google Sign-In</p>
              <p className="text-xs text-slate-600">Sign in with your Google account</p>
            </div>
            <div className="flex items-center space-x-2">
              <div ref={buttonRef} />
            </div>
          </div>
        )}

        {process.env.NEXT_PUBLIC_DEV_MODE === 'true' && (
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-600 hover:text-slate-800">
              Manual JWT entry (advanced)
            </summary>
            <div className="mt-2 space-y-2">
              <textarea
                id="local-token"
                className="w-full border border-slate-300 rounded p-2 text-sm text-slate-900"
                rows={3}
                value={localToken}
                onChange={(event) => {
                  setLocalToken(event.target.value);
                  setError(null);
                }}
                placeholder="Paste a locally issued RS256 JWT (format: header.payload.signature)"
              />
              <button
                type="button"
                onClick={handleLocalSubmit}
                className="w-full text-sm font-medium bg-slate-900 text-white rounded py-2 hover:bg-slate-800"
              >
                Use local token
              </button>
            </div>
          </details>
        )}
      </div>
    </main>
  );
}
