import { Form, Link, data, redirect, useNavigation } from 'react-router';

import { Button, Card, Icon, ImageFrame, StatusBadge, Timeline } from '@looksave/ui-web';

import { ApiError } from '@/api/client';
import { cancelOrder, getOrder } from '@/api/endpoints';
import { Deadline } from '@/components/Deadline';
import { isLocale, type Locale } from '@/i18n/locale';
import { money, phone as formatPhone } from '@/lib/format';
import { orderTimeline } from '@/lib/orderFlow';
import { requireAuth } from '@/session.server';

import type { Route } from './+types/order';

/**
 * Buyurtma tafsiloti — docs/15-sayt-dizayn.md §4.9.
 *
 * Markazda holat vaqt chizig'i: joriy qadam nurlanadi, o'tganlari
 * yashil, kelajagi kulrang. Uzilgan buyurtmada chiziq qizil tugunda
 * to'xtaydi.
 */

export function meta({ data: loaded }: Route.MetaArgs): Route.MetaDescriptors {
  return [
    { title: loaded?.order ? `${loaded.order.orderNumber} — LookSave` : 'Buyurtma — LookSave' },
    { name: 'robots', content: 'noindex' },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const context = await requireAuth(request, locale);

  try {
    const order = await getOrder(params.id, context.options);
    return data(
      { locale: locale as Locale, order },
      context.setCookie ? { headers: { 'Set-Cookie': context.setCookie } } : undefined,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new Response('Not found', { status: 404 });
    }
    throw error;
  }
}

export async function action({ params, request }: Route.ActionArgs) {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const context = await requireAuth(request, locale);

  const form = await request.formData();
  const reason = String(form.get('reason') ?? '').trim();

  try {
    await cancelOrder(params.id, reason || undefined, context.options);
  } catch (error) {
    return data(
      { error: error instanceof Error ? error.message : "Bekor qilib bo'lmadi" },
      { status: 400 },
    );
  }

  return redirect(`/${locale}/order/${params.id}`, {
    headers: context.setCookie ? { 'Set-Cookie': context.setCookie } : undefined,
  });
}

export default function Order({ loaderData, actionData }: Route.ComponentProps): JSX.Element {
  const { locale, order } = loaderData;
  const navigation = useNavigation();

  const steps = orderTimeline(order.status, {
    rejectReason: order.rejectReason,
    cancelReason: order.cancelReason,
  });

  const waiting = order.status === 'new' || order.status === 'seen';

  return (
    <div className="shell section-y">
      <Link
        to={`/${locale}/orders`}
        className="inline-flex items-center gap-1 text-small text-dim transition-colors hover:text-foreground"
      >
        <Icon name="back" size={14} />
        Buyurtmalar
      </Link>

      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1 font-bold tabular-nums">{order.orderNumber}</h1>
        <StatusBadge status={order.status} label={order.statusLabel} />
      </header>

      {waiting ? <Deadline iso={order.expiresAt} className="mt-2 text-small" /> : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:gap-12">
        <div className="flex flex-col gap-8">
          {/* ── Holat ── */}
          {steps.length > 0 ? (
            <Card className="p-6">
              <h2 className="text-label font-semibold uppercase text-dim">Holat</h2>
              <Timeline steps={steps} className="mt-5" />
            </Card>
          ) : null}

          {/* ── Mahsulotlar ── */}
          <section>
            <h2 className="text-label font-semibold uppercase text-dim">Mahsulotlar</h2>

            <ul className="mt-4 flex flex-col gap-3">
              {order.items.map((item, index) => (
                <li key={`${item.title}-${item.size}-${index}`}>
                  <Card className="flex items-center gap-4 p-3">
                    <ImageFrame
                      src={item.image}
                      alt={item.title}
                      ratio="3/4"
                      rounded="md"
                      className="w-14 shrink-0"
                    />

                    <div className="min-w-0 flex-1">
                      {item.brand ? (
                        <p className="text-tiny uppercase tracking-label text-dim">{item.brand}</p>
                      ) : null}
                      <p className="truncate text-body">{item.title}</p>
                      <p className="text-small text-dim">
                        {[item.colorName, item.size].filter(Boolean).join(' · ')} × {item.qty}
                      </p>
                    </div>

                    <span className="shrink-0 text-body font-bold tabular-nums">
                      {money(item.totalPrice, order.currency)}
                    </span>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ── Yon ustun ── */}
        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <h2 className="text-label font-semibold uppercase text-dim">Do'kon</h2>

            <Link
              to={`/${locale}/store/${order.store.id}`}
              className="mt-3 flex items-center gap-2 text-body transition-colors hover:text-brand"
            >
              <Icon name="shop" size={16} className="text-brand" />
              {order.store.name}
            </Link>

            {order.store.phone ? (
              <a
                href={`tel:${order.store.phone}`}
                className="mt-2 flex items-center gap-2 text-small text-muted-foreground transition-colors hover:text-foreground"
              >
                <Icon name="chat" size={14} />
                {formatPhone(order.store.phone)}
              </a>
            ) : null}
          </Card>

          <Card className="p-5">
            <h2 className="text-label font-semibold uppercase text-dim">Yetkazish</h2>

            <p className="mt-3 text-body">
              {order.deliveryType === 'pickup' ? "Do'kondan olib ketish" : 'Yetkazib berish'}
            </p>

            {order.address ? (
              <p className="mt-1 text-small text-muted-foreground">{order.address.text}</p>
            ) : null}

            <p className="mt-3 text-small text-dim">
              {order.contactName} · {formatPhone(order.contactPhone)}
            </p>

            {order.note ? <p className="mt-2 text-small text-dim">Izoh: {order.note}</p> : null}
          </Card>

          <Card className="p-5">
            <h2 className="text-label font-semibold uppercase text-dim">Hisob</h2>

            <dl className="mt-3 flex flex-col gap-2">
              <div className="flex justify-between">
                <dt className="text-small text-dim">Mahsulotlar</dt>
                <dd className="text-small tabular-nums">{money(order.subtotal, order.currency)}</dd>
              </div>

              <div className="flex justify-between">
                <dt className="text-small text-dim">Yetkazish</dt>
                <dd className="text-small tabular-nums">
                  {order.deliveryType === 'pickup' || Number(order.deliveryFee) === 0
                    ? '—'
                    : money(order.deliveryFee, order.currency)}
                </dd>
              </div>

              <div className="flex justify-between border-t border-border pt-3">
                <dt className="text-body font-medium">Jami</dt>
                <dd className="text-body font-bold tabular-nums">
                  {money(order.total, order.currency)}
                </dd>
              </div>
            </dl>

            <p className="mt-4 text-small text-dim">
              {order.deliveryType === 'pickup' ? "To'lov do'konda" : "To'lov yetkazib berilganda"}
            </p>
          </Card>

          {/*
            ⚠️ BEKOR QILISH SABABI SO'RALADI. Sababsiz bekor qilish
            do'kon uchun ma'lumotsiz qoladi va takrorlanuvchi muammoni
            (masalan noto'g'ri narx) hech kim ko'rmaydi. Maydon
            ixtiyoriy, lekin ko'rinib turadi.
          */}
          {order.canCancel ? (
            <Card className="p-5">
              <h2 className="text-label font-semibold uppercase text-dim">Bekor qilish</h2>

              <Form method="post" className="mt-3 flex flex-col gap-3">
                <input
                  name="reason"
                  placeholder="Sabab (ixtiyoriy)"
                  className="h-11 w-full rounded-md border border-border bg-surface px-3 text-small text-foreground transition-colors placeholder:text-dim focus:border-borderAccent focus:bg-surface2 focus:outline-none"
                />

                <Button type="submit" variant="danger" loading={navigation.state === 'submitting'}>
                  Buyurtmani bekor qilish
                </Button>

                {actionData?.error ? (
                  <p className="text-small text-danger">{actionData.error}</p>
                ) : null}
              </Form>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
