import { Form, Link, data, redirect, useNavigation } from 'react-router';

import { Button, Field } from '@looksave/ui-web';

import { login } from '@/api/endpoints';
import { isLocale, type Locale } from '@/i18n/locale';
import { auth, guest, startSession } from '@/session.server';

import type { Route } from './+types/sign-in';

/**
 * Kirish — docs/15-sayt-dizayn.md §4.11.
 *
 * ⚠️ TOKEN JAVOBDA QAYTMAYDI. `action` serverda ishlaydi, tokenni
 * `httpOnly` cookie'ga soladi va brauzerga faqat yo'naltirish yuboradi.
 * JavaScript tokenni umuman ko'rmaydi (13-sayt.md §9).
 */

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Kirish — LookSave' }, { name: 'robots', content: 'noindex' }];
}

/** Kirgan odam kirish sahifasini ko'rmasligi kerak */
export async function loader({ params, request }: Route.LoaderArgs) {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const context = await auth(request, locale);
  const next = new URL(request.url).searchParams.get('next');

  if (context.user) throw redirect(next ?? `/${locale}`);

  return { locale: locale as Locale, next };
}

export async function action({ params, request }: Route.ActionArgs) {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const form = await request.formData();

  const phone = String(form.get('phone') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const next = String(form.get('next') ?? '') || `/${locale}`;

  if (!phone || !password) {
    return data({ error: 'Telefon va parolni kiriting' }, { status: 400 });
  }

  try {
    const result = await login(phone, password, guest(request, locale));
    const cookie = await startSession(request, result);

    return redirect(next, { headers: { 'Set-Cookie': cookie } });
  } catch (error) {
    /*
     * Xato matni serverdan keladi («telefon yoki parol noto'g'ri»).
     * Umumiy «xatolik yuz berdi» odamni nima qilishni bilmay qoldiradi.
     */
    return data(
      { error: error instanceof Error ? error.message : "Kirib bo'lmadi" },
      { status: 400 },
    );
  }
}

export default function SignIn({ loaderData, actionData }: Route.ComponentProps): JSX.Element {
  const { locale, next } = loaderData;
  const navigation = useNavigation();

  return (
    <div className="shell py-20">
      <div className="mx-auto max-w-md">
        <h1 className="text-h1 font-bold">Kirish</h1>
        <p className="mt-3 text-body text-muted-foreground">
          Savat va buyurtmalar hisobingizga bog'lanadi — telefonda boshlab, brauzerda davom
          ettirasiz.
        </p>

        <Form method="post" className="mt-8 flex flex-col gap-4">
          {next ? <input type="hidden" name="next" value={next} /> : null}

          <Field
            name="phone"
            label="Telefon"
            type="tel"
            autoComplete="tel"
            placeholder="+998 90 123 45 67"
            required
          />

          <Field
            name="password"
            label="Parol"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />

          <Button
            type="submit"
            className="mt-2 w-full shadow-glow"
            loading={navigation.state === 'submitting'}
          >
            Kirish
          </Button>

          {actionData?.error ? <p className="text-small text-danger">{actionData.error}</p> : null}
        </Form>

        <p className="mt-6 text-small text-dim">
          Hisobingiz yo'qmi?{' '}
          <Link to={`/${locale}/sign-up`} className="text-brand hover:underline">
            Ro'yxatdan o'ting
          </Link>
        </p>
      </div>
    </div>
  );
}
