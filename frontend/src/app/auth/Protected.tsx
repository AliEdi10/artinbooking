'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { isAllowedRole, shouldRedirectToLogin } from './accessUtils';

export function Protected({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) {
  const { token, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (shouldRedirectToLogin(loading, token)) {
      router.replace('/login');
    }
  }, [loading, router, token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-slate-700">Checking your session...</p>
      </div>
    );
  }

  if (!token) return null;

  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole = isAllowedRole(allowedRoles, user?.role);
    if (!hasRole) {
      return (
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="max-w-md text-center space-y-3">
            <h1 className="text-xl font-semibold">Access denied</h1>
            <p className="text-sm text-slate-700">
              Your account is signed in but does not have permission to view this area. If you believe
              this is an error, contact your school administrator.
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
