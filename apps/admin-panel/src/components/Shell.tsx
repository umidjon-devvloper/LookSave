import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';

const NAV = [
  { to: '/', label: 'Umumiy holat', end: true },
  { to: '/stores', label: "Do'konlar", end: false },
  { to: '/products', label: 'Mahsulotlar', end: false },
  { to: '/brands', label: 'Brendlar', end: false },
  { to: '/3d', label: '3D navbat', end: false },
  { to: '/orders', label: 'Buyurtmalar', end: false },
  { to: '/moderation', label: 'Bloklar', end: false },
];

export function Shell(): JSX.Element {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <span className="text-xs font-semibold uppercase tracking-wordmark text-brand">
          LookSave
        </span>
        <Button
          variant="outline"
          type="button"
          className="px-3 py-1.5"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? 'Yopish' : 'Menyu'}
        </Button>
      </header>

      <aside
        className={`${menuOpen ? 'block' : 'hidden'} border-b border-border bg-surface lg:sticky lg:top-0 lg:block lg:h-screen lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r`}
      >
        <div className="hidden px-5 py-5 lg:block">
          <span className="text-xs font-semibold uppercase tracking-wordmark text-brand">
            LookSave
          </span>
          <p className="mt-1 text-xs text-dim">Admin panel</p>
        </div>

        <nav className="flex flex-col gap-1 p-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-primary/15 text-brand'
                    : 'text-muted-foreground hover:bg-surface2 hover:text-foreground'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-3 border-t border-border p-4 lg:absolute lg:bottom-0 lg:w-60">
          <p className="truncate text-sm text-foreground">{user?.fullName ?? user?.phone}</p>
          <Button variant="outline" type="button" className="w-full" onClick={() => void signOut()}>
            Chiqish
          </Button>
        </div>
      </aside>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
