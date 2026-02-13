'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { API_BASE } from '../apiClient';

// Define which roles can see each nav item
const navItems = [
  { href: '/', label: '🏠 Home', roles: ['superadmin', 'school_admin', 'driver', 'student'] },
  { href: '/superadmin', label: '🔧 Superadmin', roles: ['superadmin'] },
  { href: '/admin', label: 'Admin', roles: ['superadmin', 'school_admin'] },
  { href: '/driver', label: '📊 Dashboard', roles: ['driver'], tab: null },
  { href: '/driver?tab=schedule', label: '📅 Schedule', roles: ['driver'], tab: 'schedule' },
  { href: '/driver?tab=students', label: '👥 Students', roles: ['driver'], tab: 'students' },
  { href: '/student', label: 'My Portal', roles: ['student'] },
  { href: '/bookings', label: 'Bookings', roles: ['superadmin', 'school_admin'] },
];

function getNavItemsForRole(role: string | undefined): typeof navItems {
  if (!role) return [];
  const normalizedRole = role.toLowerCase();
  return navItems.filter(item => item.roles.includes(normalizedRole));
}

function NavigationLinks({ role }: { role: string | undefined }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');

  return (
    <>
      {getNavItemsForRole(role).map((item) => {
        // Handle active state for items with query params
        const itemPath = item.href.split('?')[0];
        const itemTab = 'tab' in item ? item.tab : undefined;

        let active = false;
        if (pathname === itemPath) {
          // For driver page, check the tab parameter
          if (itemPath === '/driver') {
            // Dashboard is active only when there's no tab or tab is not schedule/students
            if (itemTab === null) {
              active = !currentTab || (currentTab !== 'schedule' && currentTab !== 'students');
            } else {
              // Schedule or Students is active when tab matches
              active = currentTab === itemTab;
            }
          } else {
            // For other pages, just match the pathname
            active = pathname === item.href;
          }
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 min-h-[40px] text-sm rounded border whitespace-nowrap flex items-center ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-800 border-slate-200'
              }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

function HealthIndicator() {
  const [health, setHealth] = useState<{ status: string; dbLatencyMs: number | null } | null>(null);

  const fetchHealth = useCallback(() => {
    fetch(`${API_BASE}/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: 'unreachable', dbLatencyMs: null }));
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (!health) return null;

  const color =
    health.status === 'ok' && health.dbLatencyMs !== null && health.dbLatencyMs < 200
      ? 'bg-green-500'
      : health.status === 'ok'
        ? 'bg-yellow-500'
        : 'bg-red-500';

  const tooltip =
    health.status === 'ok' && health.dbLatencyMs !== null
      ? `DB: ${health.dbLatencyMs}ms`
      : 'DB: Unreachable';

  return (
    <span title={tooltip} className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Artin Driving School" className="h-10 w-10" />
            <div>
              <p className="text-lg font-semibold text-slate-900">Artin Driving School</p>
              <p className="text-xs text-slate-600 hidden sm:block">Booking System</p>
            </div>
          </div>
          <div className="text-right flex sm:flex-col items-center sm:items-end gap-2 sm:gap-0">
            <div className="flex-1 sm:flex-none">
              <p className="text-sm font-medium text-slate-900 truncate max-w-[200px] sm:max-w-none">
                {(() => {
                  const hour = new Date().getHours();
                  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
                  const name = user?.name || user?.email?.split('@')[0] || 'there';
                  return `${greeting}, ${name}`;
                })()}
              </p>
              <p className="text-xs text-slate-800 hidden sm:block">{user?.role ?? 'role unknown'}</p>
            </div>
            <div className="flex items-center gap-2">
              {user?.role === 'superadmin' && <HealthIndicator />}
              <button
                type="button"
                onClick={() => signOut()}
                className="text-xs px-3 py-1.5 min-h-[32px] rounded bg-slate-100 text-slate-800 hover:bg-slate-200 whitespace-nowrap"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
        {/* Scrollable navigation on mobile */}
        <nav className="mx-auto max-w-6xl px-4 pb-3 overflow-x-auto">
          <div className="flex space-x-2 min-w-max">
            <Suspense fallback={null}>
              <NavigationLinks role={user?.role} />
            </Suspense>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-4">{children}</main>
    </div>
  );
}

