import { Form, data, useNavigation, useRouteLoaderData } from 'react-router';

import { Icon } from '@looksave/ui-web';

import { updateProfile } from '@/api/endpoints';
import { isLocale, type Locale } from '@/i18n/locale';
import { requireAuth } from '@/session.server';

import type { Route } from './+types/index';
import type { loader as profileLoader } from '@/layouts/profile';

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Profil — LookSave' }, { name: 'robots', content: 'noindex' }];
}

export async function action({ params, request }: Route.ActionArgs) {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const context = await requireAuth(request, locale);

  const form = await request.formData();
  const fullName = String(form.get('fullName') ?? '').trim();

  if (fullName.length < 2) {
    return data({ error: 'Ismni kiriting', saved: false }, { status: 400 });
  }

  try {
    await updateProfile({ fullName }, context.options);
  } catch (error) {
    return data(
      { error: error instanceof Error ? error.message : 'Saqlab bo`lmadi', saved: false },
      { status: 400 },
    );
  }

  return data(
    { error: null as string | null, saved: true },
    context.setCookie ? { headers: { 'Set-Cookie': context.setCookie } } : undefined,
  );
}

export default function ProfileIndex({ actionData }: Route.ComponentProps): JSX.Element {
  const parent = useRouteLoaderData<typeof profileLoader>('layouts/profile');
  const navigation = useNavigation();

  const profile = parent?.profile;
  const user = parent?.user;
  const locale: Locale = parent?.locale ?? 'uz';

  return (
    <div className="flex flex-col gap-5">
      {/* ── Ma'lumotlar + 3D grafik kartasi ── */}
      <div className="relative overflow-hidden rounded-[24px] border border-primary/20 bg-gradient-to-br from-[#161226] via-[#0f0a1e] to-[#0a071a] p-7 shadow-[0_0_50px_-15px_rgba(139,92,246,0.25)]">
        {/* Ambient glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-primary/20 blur-[80px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 left-1/3 size-48 rounded-full bg-brand/10 blur-[70px]"
        />

        <div className="relative z-10">
          {/* Right: 3D card floating absolutely — does not compress the form */}
          <div className="absolute end-0 top-0 hidden lg:block">
            <div className="relative w-52 xl:w-64">
              <div
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-primary/25 blur-[60px]"
              />
              <img
                src="/img/profile-hero-card.jpg"
                alt="Profile security card"
                className="relative w-full object-contain drop-shadow-[0_10px_40px_rgba(139,92,246,0.5)] mix-blend-lighten pointer-events-none select-none"
                style={{
                  maskImage: 'radial-gradient(ellipse at center, black 50%, transparent 78%)',
                  WebkitMaskImage: 'radial-gradient(ellipse at center, black 50%, transparent 78%)',
                }}
              />
            </div>
          </div>

          {/* Left: Form — padded on the right so it doesn't overlap the card */}
          <div className="lg:pe-56 xl:pe-72">
            <p className="text-xs font-bold uppercase tracking-widest text-brand">Ma'lumotlar</p>

            <Form method="post" className="mt-5 flex flex-col gap-5">
              {/* ISM field */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-dim">
                  Ism
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 start-4 flex items-center text-dim">
                    <Icon name="profile" size={17} />
                  </span>
                  <input
                    name="fullName"
                    defaultValue={profile?.fullName ?? user?.fullName ?? ''}
                    placeholder="Ismingiz"
                    required
                    className="h-14 w-full rounded-xl border border-border/60 bg-surface/50 ps-11 pe-4 text-sm text-foreground placeholder:text-dim transition-colors focus:border-primary/60 focus:bg-surface2/60 focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>
                {actionData?.error && (
                  <p className="mt-2 text-xs text-red-400">{actionData.error}</p>
                )}
              </div>

              {/* TELEFON field */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-dim">
                  Telefon
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 start-4 flex items-center text-dim">
                    <Icon name="authentic" size={17} />
                  </span>
                  <input
                    defaultValue={profile?.phone ?? user?.phone ?? ''}
                    disabled
                    className="h-14 w-full rounded-xl border border-border/40 bg-surface/30 ps-11 pe-4 text-sm text-dim cursor-not-allowed opacity-70"
                  />
                </div>
                <p className="mt-2 text-xs text-dim leading-relaxed">
                  Telefon raqamini o'zgartirish uchun qo'llab-quvvatlashga yozing — u
                  buyurtmalaringizga bog'langan.
                </p>
              </div>

              {/* Save button */}
              <div className="flex items-center gap-4 pt-1">
                <button
                  type="submit"
                  disabled={navigation.state === 'submitting'}
                  className="group inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-primary to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(139,92,246,0.4)] transition-all hover:shadow-[0_4px_28px_rgba(139,92,246,0.6)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
                >
                  <Icon name="authentic" size={17} />
                  {navigation.state === 'submitting' ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>

                {actionData?.saved ? (
                  <span className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                    <span className="flex size-5 items-center justify-center rounded-full bg-emerald-400/20">
                      <Icon name="authentic" size={13} />
                    </span>
                    Saqlandi!
                  </span>
                ) : null}
              </div>
            </Form>
          </div>
        </div>
      </div>

      {/* ── Kiyintirish uchun surat ── */}
      <div className="relative overflow-hidden rounded-[24px] border border-primary/20 bg-gradient-to-br from-[#161226] to-[#0e0a1b] p-7 shadow-xl">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-10 -bottom-10 size-48 rounded-full bg-brand/10 blur-[70px]"
        />

        <div className="relative z-10">
          <p className="text-xs font-bold uppercase tracking-widest text-brand">
            Kiyintirish uchun surat
          </p>

          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 shadow-[0_0_20px_rgba(139,92,246,0.3)]">
                <Icon name="tryon" size={26} className="text-brand" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {profile?.avatarUrl
                    ? 'Surat yuklangan.'
                    : 'Surat hali yuklanmagan. Kiyintirish uchun u ilovada yuklanadi.'}
                </p>
                <p className="mt-2 text-xs text-dim leading-relaxed">
                  Surat serverga va kiyintirish provayderiga yuboriladi — batafsil{' '}
                  <a
                    href={`/${locale}/privacy`}
                    className="text-brand hover:underline underline-offset-2"
                  >
                    maxfiylik siyosatida
                  </a>
                  .
                </p>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-2.5 rounded-xl border border-primary/30 bg-surface/60 px-5 py-3 text-sm font-semibold text-foreground transition-all hover:border-primary/60 hover:bg-primary/10"
            >
              <Icon name="camera" size={16} className="text-brand" />
              Surat yuklash
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
