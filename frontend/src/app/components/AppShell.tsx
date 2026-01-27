'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../auth/AuthProvider';

// Define which roles can see each nav item
const navItems = [
  { href: '/', label: 'Overview', roles: ['superadmin', 'school_admin', 'driver', 'student'] },
  { href: '/superadmin', label: '🔧 Superadmin', roles: ['superadmin'] },
  { href: '/admin', label: 'Admin', roles: ['superadmin', 'school_admin'] },
  { href: '/driver', label: 'Dashboard', roles: ['driver'] },
  { href: '/student', label: 'My Portal', roles: ['student'] },
  { href: '/bookings', label: 'Bookings', roles: ['superadmin', 'school_admin'] },
];

function getNavItemsForRole(role: string | undefined): typeof navItems {
  if (!role) return [];
  const normalizedRole = role.toLowerCase();
  return navItems.filter(item => item.roles.includes(normalizedRole));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-lg font-semibold text-slate-900">artinbk portal</p>
            <p className="text-xs text-slate-700 hidden sm:block">Role-aware dashboards & booking flows</p>
          </div>
          <div className="text-right flex sm:flex-col items-center sm:items-end gap-2 sm:gap-0">
            <div className="flex-1 sm:flex-none">
              <p className="text-sm font-medium text-slate-900 truncate max-w-[150px] sm:max-w-none">{user?.email ?? 'Signed out'}</p>
              <p className="text-xs text-slate-700 hidden sm:block">{user?.role ?? 'role unknown'}</p>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="text-xs px-3 py-1.5 min-h-[32px] rounded bg-slate-100 text-slate-700 hover:bg-slate-200 whitespace-nowrap"
            >
              Sign out
            </button>
          </div>
        </div>
        {/* Scrollable navigation on mobile */}
        <nav className="mx-auto max-w-6xl px-4 pb-3 overflow-x-auto">
          <div className="flex space-x-2 min-w-max">
            {getNavItemsForRole(user?.role).map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 min-h-[40px] text-sm rounded border whitespace-nowrap flex items-center ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'
                    }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-4">{children}</main>
    </div>
  );
}
