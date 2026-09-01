import { useState } from 'react';
import { Form, Link, data, redirect, useNavigation } from 'react-router';

import { Button, Card, CartArt, Field, Icon, ImageFrame } from '@looksave/ui-web';

import { createOrderSchema } from '@looksave/validation';

import { createOrder, getCart } from '@/api/endpoints';
import { isLocale, type Locale } from '@/i18n/locale';
import { money } from '@/lib/format';
import { requireAuth } from '@/session.server';

import type { Route } from './+types/checkout';

/**
 * Checkout — docs/15-sayt-dizayn.md §4.8.
 *
 * ⚠️ TO'LOV MAYDONI YO'Q va bu ataylab (00-README K-10): MVP da onlayn
 * to'lov yo'q, buyurtma — do'konga so'rov. To'lov do'konda yoki
 * yetkazib berilganda.
 *
 * ⚠️ `Idempotency-Key` LOADER'DA yasaladi, action'da emas. Agar u har
 * yuborishda yangidan yasalsa, tarmoq uzilib forma ikki marta ketganda
 * IKKI buyurtma yaratilardi (03-api-spec §12).
 */

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Rasmiylashtirish — LookSave' }, { name: 'robots', content: 'noindex' }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const context = await requireAuth(request, locale);

  const cart = await getCart(context.options);
  const storeId = new URL(request.url).searchParams.get('store');
  const group = storeId ? cart.stores.find((item) => item.store.id === storeId) : cart.stores[0];

  return data(
    {
      locale: locale as Locale,
      group: group ?? null,
      user: context.user,
      idempotencyKey: crypto.randomUUID(),
    },
    context.setCookie ? { headers: { 'Set-Cookie': context.setCookie } } : undefined,
  );
}

export async function action({ params, request }: Route.ActionArgs) {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const context = await requireAuth(request, locale);

  const form = await request.formData();
  const deliveryType = form.get('deliveryType') === 'pickup' ? 'pickup' : 'delivery';
  const addressLat = Number(form.get('addressLat'));
  const addressLng = Number(form.get('addressLng'));
  const note = String(form.get('note') ?? '').trim();
  const storeId = String(form.get('storeId') ?? '');
  const idempotencyKey = String(form.get('idempotencyKey') ?? '');

  /*
   * ⚠️ SAVAT SERVERDA QAYTA O'QILADI. Mahsulot ro'yxatini formadan olish
   * mumkin edi, lekin u holda brauzerdan kelgan narsaga ishonilardi —
   * boshqa odamning savat elementini yuborish yo'li ochiq qolardi.
   */
  const cart = await getCart(context.options);
  const group = cart.stores.find((item) => item.store.id === storeId);

  const input = {
    storeId,
    deliveryType,
    contactName: String(form.get('contactName') ?? '').trim(),
    contactPhone: String(form.get('contactPhone') ?? '').trim(),
    ...(note ? { note } : {}),
    ...(deliveryType === 'delivery'
      ? {
          address: {
            text: String(form.get('addressText') ?? '').trim(),
            lat: addressLat,
            lng: addressLng,
          },
        }
      : {}),
    items: (group?.items ?? []).map((item) => ({
      variantId: item.variantId,
      size: item.size,
      qty: item.qty,
    })),
  };

  /*
   * ⚠️ Tekshiruv `@looksave/validation` DAN — server bilan bir xil zod
   * sxemasi. Qoidani bu yerda qayta yozish ikki manba yaratardi va ular
   * bir kun ajralib ketardi (00-README §6).
   */
  const parsed = createOrderSchema.safeParse(input);

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.');
      // `address.lat` → maydon emas, xabar manzil qatoriga tushadi
      const key = field.startsWith('address') ? 'addressText' : field;
      errors[key] ??= issue.message;
    }

    if (errors['addressText'] && !Number.isFinite(addressLat)) {
      errors['addressText'] = 'Xaritadagi joyni belgilang — kuryerga koordinata kerak';
    }

    return data({ errors, error: null as string | null }, { status: 400 });
  }

  try {
    const order = await createOrder(parsed.data, idempotencyKey, context.options);

    return redirect(`/${locale}/order/${order.id}`, {
      headers: context.setCookie ? { 'Set-Cookie': context.setCookie } : undefined,
    });
  } catch (error) {
    return data(
      {
        errors: {} as Record<string, string>,
        error: error instanceof Error ? error.message : 'Buyurtma yuborilmadi',
      },
      { status: 400 },
    );
  }
}

export default function Checkout({ loaderData, actionData }: Route.ComponentProps): JSX.Element {
  const { locale, group, user, idempotencyKey } = loaderData;
  const navigation = useNavigation();
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const errors = actionData?.errors ?? {};
  const failure = actionData?.error ?? null;
  const submitting = navigation.state === 'submitting';

  const pickLocation = (): void => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 },
    );
  };

  if (!group) {
    return (
      <div className="shell py-24">
        <div className="flex flex-col items-center gap-6 text-center">
          <CartArt size={170} idPrefix="checkout" />
          <div>
            <h1 className="text-h2 font-bold">Rasmiylashtirish uchun savat bo'sh</h1>
            <p className="mx-auto mt-2 max-w-[46ch] text-body text-muted-foreground">
              Avval mahsulot qo'shing — keyin bu sahifa bir daqiqalik ish bo'ladi.
            </p>
          </div>
          <Button asChild className="shadow-glow">
            <Link to={`/${locale}/catalog`}>Katalogga o'tish</Link>
          </Button>
        </div>
      </div>
    );
  }

  const currency = group.store.currency;
  const pickup = deliveryType === 'pickup';
  const total = pickup ? group.subtotal : group.total;

  return (
    <div className="shell section-y">
      <Link
        to={`/${locale}/cart`}
        className="inline-flex items-center gap-1 text-small text-dim transition-colors hover:text-foreground"
      >
        <Icon name="back" size={14} />
        Savatga qaytish
      </Link>

      <h1 className="mt-4 text-h1 font-bold">Rasmiylashtirish</h1>
      <p className="mt-2 flex items-center gap-2 text-small text-dim">
        <Icon name="shop" size={14} className="text-brand" />
        {group.store.name}
      </p>

      <Form method="post" className="mt-8 grid gap-10 lg:grid-cols-[1.3fr_0.7fr] lg:gap-14">
        <input type="hidden" name="storeId" value={group.store.id} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <input type="hidden" name="deliveryType" value={deliveryType} />

        <div className="flex flex-col gap-8">
          {/* ── 1. Olish usuli ── */}
          <Step number={1} title="Olish usuli">
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { value: 'pickup', label: "Do'kondan olib ketish", hint: 'Bepul', icon: 'shop' },
                  {
                    value: 'delivery',
                    label: 'Yetkazib berish',
                    hint:
                      Number(group.deliveryFee) === 0
                        ? 'Bepul'
                        : money(group.deliveryFee, currency),
                    icon: 'delivery',
                  },
                ] as const
              ).map((option) => {
                const active = deliveryType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setDeliveryType(option.value)}
                    className={
                      active
                        ? 'flex flex-col items-start gap-2 rounded-card border border-borderAccent bg-primarySoft p-4 text-start transition-colors'
                        : 'flex flex-col items-start gap-2 rounded-card border border-border bg-surface p-4 text-start transition-colors hover:border-borderStrong'
                    }
                  >
                    <Icon
                      name={option.icon}
                      size={20}
                      className={active ? 'text-brand' : 'text-dim'}
                    />
                    <span className="text-body text-foreground">{option.label}</span>
                    <span className="text-small text-dim">{option.hint}</span>
                  </button>
                );
              })}
            </div>
          </Step>

          {/* ── 2. Aloqa ── */}
          <Step number={2} title="Aloqa">
            <div className="flex flex-col gap-4">
              <Field
                name="contactName"
                label="Ism"
                defaultValue={user.fullName ?? ''}
                placeholder="Ismingiz"
                error={errors['contactName'] ?? null}
                required
              />

              <Field
                name="contactPhone"
                label="Telefon"
                type="tel"
                defaultValue={user.phone}
                placeholder="+998 90 123 45 67"
                error={errors['contactPhone'] ?? null}
                required
              />
            </div>
          </Step>

          {/* ── 3. Manzil (faqat yetkazib berishda) ── */}
          {!pickup ? (
            <Step number={3} title="Manzil">
              <div className="flex flex-col gap-4">
                <Field
                  name="addressText"
                  label="Manzil"
                  placeholder="Ko'cha, uy, xonadon"
                  error={errors['addressText'] ?? null}
                />

                {/*
                  ⚠️ KOORDINATA MAJBURIY (`addressSchema`): kuryer manzilni
                  matn bo'yicha topa olmaydi va yetkazish radiusi ham
                  koordinatasiz tekshirilmaydi. Xarita tanlagichi WEB-11 da;
                  hozircha brauzer joylashuvi ishlatiladi.
                */}
                <input type="hidden" name="addressLat" value={coords?.lat ?? ''} />
                <input type="hidden" name="addressLng" value={coords?.lng ?? ''} />

                <div
                  className={
                    coords
                      ? 'flex items-center gap-3 rounded-card border border-success/40 bg-success/[0.08] p-4'
                      : 'flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-4'
                  }
                >
                  <Icon
                    name="location"
                    size={18}
                    className={coords ? 'text-success' : 'text-dim'}
                  />

                  <span className="flex-1 text-small text-muted-foreground">
                    {coords
                      ? 'Joy belgilandi — kuryer shu nuqtaga yo`naltiriladi.'
                      : 'Kuryerga koordinata kerak. Joylashuvga ruxsat bering.'}
                  </span>

                  {!coords ? (
                    <Button type="button" variant="ghost" loading={locating} onClick={pickLocation}>
                      Joyni belgilash
                    </Button>
                  ) : null}
                </div>
              </div>
            </Step>
          ) : null}

          {/* ── 4. Izoh ── */}
          <Step number={pickup ? 3 : 4} title="Izoh">
            <Field
              name="note"
              placeholder="Ixtiyoriy: qo'ng'iroq qilmang, eshik oldiga qoldiring…"
            />
          </Step>
        </div>

        {/* ── Xulosa ── */}
        <aside className="lg:sticky lg:top-[6.5rem] lg:self-start">
          <Card className="p-6">
            <h2 className="text-label font-semibold uppercase text-dim">Buyurtma</h2>

            <ul className="mt-4 flex flex-col gap-3">
              {group.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3">
                  <ImageFrame
                    src={item.image}
                    alt=""
                    ratio="3/4"
                    rounded="md"
                    className="w-10 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-small text-foreground">{item.title}</span>
                    <span className="block text-tiny text-dim">
                      {[item.colorName, item.size].filter(Boolean).join(' · ')} × {item.qty}
                    </span>
                  </span>
                  <span className="shrink-0 text-small tabular-nums text-foreground">
                    {money(item.totalPrice, currency)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-5 flex flex-col gap-2 border-t border-border pt-4">
              <div className="flex justify-between">
                <dt className="text-small text-dim">Mahsulotlar</dt>
                <dd className="text-small tabular-nums text-muted-foreground">
                  {money(group.subtotal, currency)}
                </dd>
              </div>

              {/*
                ⚠️ QATOR O'CHMAYDI, QIYMATI O'ZGARADI. «Do'kondan olib
                ketish» tanlanganda yetkazish qatori yo'qolsa, xulosa
                sakraydi va jami nega kamayganini odam tushunmaydi
                (15-sayt-dizayn.md §4.8).
              */}
              <div className="flex justify-between">
                <dt className="text-small text-dim">Yetkazish</dt>
                <dd
                  className={
                    pickup || Number(group.deliveryFee) === 0
                      ? 'text-small tabular-nums text-success'
                      : 'text-small tabular-nums text-muted-foreground'
                  }
                >
                  {pickup
                    ? '—'
                    : Number(group.deliveryFee) === 0
                      ? 'Bepul'
                      : money(group.deliveryFee, currency)}
                </dd>
              </div>

              <div className="flex justify-between border-t border-border pt-3">
                <dt className="text-body font-medium">Jami</dt>
                <dd className="text-body font-bold tabular-nums">{money(total, currency)}</dd>
              </div>
            </dl>

            <Button type="submit" className="mt-6 w-full shadow-glow" loading={submitting}>
              Buyurtma berish
            </Button>

            {failure ? <p className="mt-3 text-small text-danger">{failure}</p> : null}

            {/*
              To'lov matni TARJIMA QILINADIGAN joyda turadi. Ilovada u
              qattiq yozilgan (`app/checkout.tsx:280`) va inglizcha
              interfeysda o'zbekcha chiqadi — bu yerda takrorlanmaydi.
            */}
            <p className="mt-3 text-small text-dim">
              {pickup ? "To'lov do'konda" : "To'lov yetkazib berilganda"}. Onlayn to'lov yo'q.
            </p>
          </Card>
        </aside>
      </Form>
    </div>
  );
}

/**
 * Raqamlangan qadam.
 *
 * ⚠️ RAQAMLAR HAQIQIY KETMA-KETLIKNI BILDIRADI — bu bezak emas
 * (15-sayt-dizayn.md: «raqamlash faqat tartib ma'no tashiganda»).
 * «Do'kondan olib ketish» tanlanganda manzil qadami tushib qoladi va
 * izoh 4 emas, 3 bo'ladi.
 */
function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section>
      <h2 className="flex items-center gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-borderStrong text-tiny font-bold tabular-nums text-brand">
          {number}
        </span>
        <span className="text-h3 font-semibold">{title}</span>
      </h2>

      <div className="mt-4 ps-10">{children}</div>
    </section>
  );
}
