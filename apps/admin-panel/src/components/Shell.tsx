import { useState } from 'react';
import {
  Bell,
  Boxes,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  ShoppingBag,
  Store,
  Tags,
  Images,
  UserRound,
  X,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';

const NAV = [
  { to: '/', label: 'Umumiy holat', icon: LayoutDashboard, end: true },
  { to: '/stores', label: "Do'konlar", icon: Store, end: false },
  { to: '/products', label: 'Mahsulotlar', icon: Package, end: false },
  { to: '/brands', label: 'Brendlar', icon: Tags, end: false },
  { to: '/banners', label: 'Reklama bannerlari', icon: Images, end: false },
  { to: '/orders', label: 'Buyurtmalar', icon: ClipboardList, end: false },
  { to: '/moderation', label: 'Bloklar', icon: Boxes, end: false },
];

export function Shell(): JSX.Element {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="admin-shell flex min-h-full flex-col lg:flex-row">
      <header className="flex items-center justify-between border-b border-border bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          <span className="brand-bag"><ShoppingBag size={18} /></span>
          <span className="text-sm font-bold tracking-wordmark text-foreground">LOOK<span className="text-brand">SAVE</span></span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X /> : <Menu />}
        </Button>
      </header>

      <aside
        className={`${menuOpen ? 'block' : 'hidden'} admin-sidebar border-b border-border lg:sticky lg:top-0 lg:block lg:h-screen lg:w-[278px] lg:shrink-0 lg:border-b-0 lg:border-r`}
      >
        <div className="hidden items-center gap-4 px-8 pb-10 pt-7 lg:flex">
          <span className="brand-bag"><ShoppingBag size={22} /></span>
          <div>
            <span className="text-xl font-bold tracking-wordmark text-foreground">LOOK<span className="text-brand">SAVE</span></span>
            <p className="mt-1 text-sm text-muted-foreground">Admin panel</p>
          </div>
        </div>

        <nav className="flex flex-col gap-2 px-4">
          {NAV.map((item) => {
            const NavIcon = item.icon;
            return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `group flex min-h-14 items-center gap-4 rounded-2xl px-5 text-base font-medium transition ${
                  isActive
                    ? 'nav-active text-foreground'
                    : 'text-muted-foreground hover:bg-surface2/80 hover:text-foreground'
                }`
              }
            >
              <NavIcon className="h-5 w-5 transition group-hover:text-brand" />
              {item.label}
            </NavLink>
          )})}
        </nav>

        <div className="space-y-1 border-t border-border p-4 lg:absolute lg:bottom-0 lg:w-full">
          <div className="flex items-center gap-4 rounded-2xl px-4 py-3 text-muted-foreground">
            <UserRound className="h-5 w-5" />
            <span className="truncate text-sm">{user?.fullName ?? user?.phone ?? 'Operator'}</span>
          </div>
          <button type="button" className="flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-sm text-muted-foreground transition hover:bg-surface2 hover:text-foreground" onClick={() => void signOut()}>
            <LogOut className="h-5 w-5" /> Chiqish
          </button>
        </div>
      </aside>

      <section className="min-w-0 flex-1">
        <header className="admin-topbar hidden h-20 items-center justify-end gap-7 border-b border-border px-8 lg:flex">
          <label className="search-box flex h-12 w-[312px] items-center gap-3 rounded-2xl border border-border px-4 text-muted-foreground">
            <Search className="h-5 w-5" />
            <input className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" placeholder="Qidirish..." />
          </label>
          <button className="relative text-muted-foreground transition hover:text-foreground" aria-label="Bildirishnomalar">
            <Bell className="h-6 w-6" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-brand" />
          </button>
          <span className="h-8 w-px bg-border" />
          <button className="flex items-center gap-3 text-muted-foreground" aria-label="Profil menyusi">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand to-primary text-base font-semibold text-white">{(user?.fullName ?? 'A').charAt(0).toUpperCase()}</span>
            <ChevronDown className="h-5 w-5" />
          </button>
        </header>
        <main className="px-4 py-7 sm:px-6 lg:px-9 lg:py-7">
          <Outlet />
        </main>
      </section>
    </div>
  );
}
