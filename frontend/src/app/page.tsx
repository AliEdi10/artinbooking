'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Protected } from './auth/Protected';
import { AppShell } from './components/AppShell';
import { useAuth } from './auth/AuthProvider';

// Redirect to role-specific page
function getRoleDefaultPage(role: string | undefined): string {
  switch (role?.toLowerCase()) {
    case 'superadmin':
    case 'school_admin':
      return '/admin';
    case 'driver':
      return '/driver';
    case 'student':
      return '/student';
    default:
      return '/login';
  }
}

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role) {
      const targetPage = getRoleDefaultPage(user.role);
      router.replace(targetPage);
    }
  }, [user, loading, router]);

  return (
    <Protected>
      <AppShell>
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-center">
            <p className="text-lg font-medium">Redirecting...</p>
            <p className="text-sm text-slate-500">Taking you to your dashboard</p>
          </div>
        </div>
      </AppShell>
    </Protected>
  );
}
