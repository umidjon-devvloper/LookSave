import { Form, Link, data, redirect, useNavigation } from 'react-router';

import { Button, Field } from '@looksave/ui-web';

import { register } from '@/api/endpoints';
import { isLocale, type Locale } from '@/i18n/locale';
import { auth, guest, startSession } from '@/session.server';

import type { Route } from './+types/sign-up';

export function meta(): Route.MetaDescriptors {
  return [{ title: "Ro'yxatdan o'tish — LookSave" }, { name: 'robots', content: 'noindex' }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const context = await auth(request, locale);
  if (context.user) throw redirect(`/${locale}`);
  return { locale: locale as Locale };
}

export async function action({ params, request }: Route.ActionArgs) {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const form = await request.formData();

  const phone = String(form.get('phone') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const name = String(form.get('name') ?? '').trim();

  const errors: Record<string, string> = {};
  // ⚠️ Ism MAJBURIY — `registerSchema.fullName`. Serverga bo'sh yuborilsa 422
  if (name.length < 2) errors['name'] = 'Ismingizni kiriting';
  if (phone.length < 7) errors['phone'] = 'Telefon raqamini kiriting';
  if (password.length < 8) errors['password'] = "Parol kamida 8 belgidan iborat bo'lsin";

  if (Object.keys(errors).length > 0) {
    return data({ errors, error: null as string | null }, { status: 400 });
  }

  try {
    const result = await register(
      { phone, password, fullName: name, locale },
      guest(request, locale),
    );
    const cookie = await startSession(request, result);
    return redirect(`/${locale}`, { headers: { 'Set-Cookie': cookie } });
  } catch (error) {
    return data(
      {
        errors: {} as Record<string, string>,
        error: error instanceof Error ? error.message : "Ro'yxatdan o'tib bo'lmadi",
      },
      { status: 400 },
    );
  }
}

export default function SignUp({ loaderData, actionData }: Route.ComponentProps): JSX.Element {
  const { locale } = loaderData;
  const navigation = useNavigation();
  const errors = actionData?.errors ?? {};

  return (
    <div className="shell py-20">
      <div className="mx-auto max-w-md">
        <h1 className="text-h1 font-bold">Ro'yxatdan o'tish</h1>
        <p className="mt-3 text-body text-muted-foreground">
          Telefon raqami buyurtmani do'kon bilan bog'laydi — soxta buyurtmaga qarshi asosiy himoya.
        </p>

        <Form method="post" className="mt-8 flex flex-col gap-4">
          <Field
            name="name"
            label="Ism"
            autoComplete="name"
            placeholder="Ismingiz"
            error={errors['name'] ?? null}
            required
          />

          <Field
            name="phone"
            label="Telefon"
            type="tel"
            autoComplete="tel"
            placeholder="+998 90 123 45 67"
            error={errors['phone'] ?? null}
            required
          />

          <Field
            name="password"
            label="Parol"
            type="password"
            autoComplete="new-password"
            placeholder="Kamida 8 belgi"
            error={errors['password'] ?? null}
            required
          />

          <Button
            type="submit"
            className="mt-2 w-full shadow-glow"
            loading={navigation.state === 'submitting'}
          >
            Davom etish
          </Button>

          {actionData?.error ? <p className="text-small text-danger">{actionData.error}</p> : null}
        </Form>

        <p className="mt-6 text-small text-dim">
          Hisobingiz bormi?{' '}
          <Link to={`/${locale}/sign-in`} className="text-brand hover:underline">
            Kirish
          </Link>
        </p>
      </div>
    </div>
  );
}
