import { useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { useOrderStream } from '../../hooks/useOrderStream';

const NAV = [
  { to: '/', label: 'Bosh sahifa', end: true },
  { to: '/orders', label: 'Buyurtmalar', end: false },
  { to: '/products', label: 'Mahsulotlar', end: false },
  { to: '/analytics', label: 'Statistika', end: false },
  { to: '/invoices', label: 'Hisoblar', end: false },
  { to: '/blocklist', label: "Qora ro'yxat", end: false },
  { to: '/team', label: 'Jamoa', end: false },
  { to: '/settings', label: 'Sozlamalar', end: false },
  { to: '/telegram', label: 'Telegram', end: false },
];

/** Do'kon egasi boshqa oynada ishlayotgan bo'lishi mumkin — sarlavhada sanoq. */
function useTitleCounter(): (orderNumber: string) => void {
  const unseen = useRef(0);

  return (orderNumber: string) => {
    unseen.current += 1;
    document.title = `(${unseen.current}) LookSave — yangi buyurtma`;

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Yangi buyurtma', { body: orderNumber });
    }
  };
}

export function Shell(): JSX.Element {
  const { user, signOut } = useAuth();
  const notify = useTitleCounter();
  const [menuOpen, setMenuOpen] = useState(false);

  const stream = useOrderStream(true, {
    onNewOrder: (order) => notify(order.orderNumber),
  });

  const streamLabel =
    stream === 'live'
      ? { text: 'Jonli', className: 'text-success', dot: 'bg-success' }
      : stream === 'connecting'
        ? { text: 'Ulanmoqda', className: 'text-muted', dot: 'bg-muted' }
        : { text: 'Aloqa yo‘q', className: 'text-warning', dot: 'bg-warning' };

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <span className="text-xs font-semibold uppercase tracking-wordmark text-accent">
          LookSave
        </span>
        <button
          type="button"
          className="btn-ghost px-3 py-1.5"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? 'Yopish' : 'Menyu'}
        </button>
      </header>

      <aside
        className={`${menuOpen ? 'block' : 'hidden'} border-b border-border bg-surface lg:sticky lg:top-0 lg:block lg:h-screen lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r`}
      >
        <div className="hidden px-5 py-5 lg:block">
          <span className="text-xs font-semibold uppercase tracking-wordmark text-accent">
            LookSave
          </span>
          <p className="mt-1 text-xs text-dim">Do'kon kabineti</p>
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
                    ? 'bg-primary/15 text-accent'
                    : 'text-muted hover:bg-surface2 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-3 border-t border-border p-4 lg:absolute lg:bottom-0 lg:w-60">
          <p className={`flex items-center gap-2 text-xs ${streamLabel.className}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${streamLabel.dot}`} />
            {streamLabel.text}
          </p>
          <p className="truncate text-sm text-white">{user?.fullName ?? user?.phone}</p>
          <button type="button" className="btn-ghost w-full" onClick={() => void signOut()}>
            Chiqish
          </button>
        </div>
      </aside>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
