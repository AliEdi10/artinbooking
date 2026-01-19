'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../auth/AuthProvider';

// Define which roles can see each nav item
const navItems = [
  { href: '/', label: 'Overview', roles: ['superadmin', 'school_admin', 'driver', 'student'] },
  { href: '/superadmin', label: '🔧 Superadmin', roles: ['superadmin'] },
  { href: '/admin', label: 'Admin', roles: ['superadmin', 'school_admin'] },
  { href: '/driver', label: 'My Schedule', roles: ['driver'] },
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
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold text-slate-900">artinbk portal</p>
            <p className="text-xs text-slate-700">Role-aware dashboards & booking flows</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-slate-900">{user?.email ?? 'Signed out'}</p>
            <p className="text-xs text-slate-700">{user?.role ?? 'role unknown'}</p>
            <div className="mt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => signOut()}
                className="text-xs px-3 py-1.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
        <nav className="mx-auto max-w-6xl px-4 pb-3 flex space-x-2">
          {getNavItemsForRole(user?.role).map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 text-sm rounded border ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'
                  }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-4">{children}</main>
    </div>
  );
}
