import { Form, NavLink, Outlet, data } from 'react-router';

import { Icon, type IconName } from '@looksave/ui-web';

import { getProfile, type FullProfile } from '@/api/endpoints';
import { isLocale, type Locale } from '@/i18n/locale';
import { phone as formatPhone } from '@/lib/format';
import { cn } from '@/lib/utils';
import { requireAuth } from '@/session.server';

import type { Route } from './+types/profile';

const LINKS: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: '', label: 'Profil', icon: 'profile', end: true },
  { to: 'measurements', label: "O'lchovlar", icon: 'tryon' },
  { to: '/orders', label: 'Buyurtmalar', icon: 'orders' },
  { to: '/cart', label: 'Savat', icon: 'cart' },
];

export async function loader({ params, request }: Route.LoaderArgs) {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const context = await requireAuth(request, locale);

  const profile = await getProfile(context.options).catch((): FullProfile | null => null);

  return data(
    { locale: locale as Locale, user: context.user, profile },
    context.setCookie ? { headers: { 'Set-Cookie': context.setCookie } } : undefined,
  );
}

export default function ProfileLayout({ loaderData }: Route.ComponentProps): JSX.Element {
  const { locale, user, profile } = loaderData;
  const name = profile?.fullName ?? user.fullName ?? 'Foydalanuvchi';

  return (
    <div className="shell-wide section-y">
      {/* Page heading */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Profil
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Shaxsiy ma'lumotlaringizni boshqaring
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[17rem_1fr] lg:gap-8">
        {/* ── Sidebar ── */}
        <aside className="lg:sticky lg:top-[6.5rem] lg:self-start">
          {/* User avatar card */}
          <div className="relative overflow-hidden rounded-[20px] border border-primary/25 bg-gradient-to-b from-[#1a1035] to-[#0f0a1e] p-5 shadow-[0_0_40px_-10px_rgba(139,92,246,0.3)]">
            {/* Background glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-0 size-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[70px]"
            />

            <div className="relative flex items-center gap-3">
              <div className="relative flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/50 to-primary/20 ring-2 ring-primary/40 shadow-[0_0_20px_rgba(139,92,246,0.4)]">
                <Icon name="profile" size={24} className="text-brand" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-foreground">{name}</p>
                <p className="mt-0.5 text-xs text-dim">
                  {formatPhone(profile?.phone ?? user.phone)}
                </p>
              </div>
            </div>
          </div>

          {/* Nav links */}
          <nav className="mt-3 flex flex-col gap-1 rounded-[20px] border border-primary/15 bg-gradient-to-b from-[#161226] to-[#0e0a1b] p-3 shadow-xl">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={
                  link.to.startsWith('/') ? `/${locale}${link.to}` : `/${locale}/profile/${link.to}`
                }
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary/20 text-brand shadow-[inset_0_0_0_1px_rgba(139,92,246,0.35)]'
                      : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'flex size-8 items-center justify-center rounded-lg transition-colors',
                        isActive
                          ? 'bg-primary/30 text-brand'
                          : 'bg-surface/60 text-muted-foreground group-hover:text-foreground',
                      )}
                    >
                      <Icon name={link.icon} size={16} />
                    </span>
                    {link.label}
                    {isActive && <Icon name="next" size={14} className="ms-auto text-brand/60" />}
                  </>
                )}
              </NavLink>
            ))}

            <div className="my-1 h-px bg-border/50" />

            <Form method="post" action={`/${locale}/sign-out`}>
              <button
                type="submit"
                className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-red-500/10 hover:text-red-400"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-surface/60 transition-colors group-hover:bg-red-500/20 group-hover:text-red-400">
                  <Icon name="logout" size={16} />
                </span>
                Chiqish
              </button>
            </Form>
          </nav>

          {/* Security badge */}
          <div className="mt-3 overflow-hidden rounded-[18px] border border-primary/20 bg-gradient-to-br from-[#1a1035] to-[#0e0a1b] p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-brand">
                <Icon name="authentic" size={16} />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Hisobingiz xavfsiz</p>
                <p className="mt-1 text-xs text-dim leading-relaxed">
                  Ma'lumotlaringiz himoyalangan va maxfiy saqlanadi.
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
