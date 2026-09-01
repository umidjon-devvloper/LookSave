import { Link, data } from 'react-router';

import { Button, Card, Empty, ImageFrame, StatusBadge } from '@looksave/ui-web';

import { getOrders, type OrderCard, type OrderTab } from '@/api/endpoints';
import { Deadline } from '@/components/Deadline';
import { isLocale, type Locale } from '@/i18n/locale';
import { money } from '@/lib/format';
import { requireAuth } from '@/session.server';

import type { Route } from './+types/orders';

/**
 * Buyurtmalar ro'yxati — docs/15-sayt-dizayn.md §4.9.
 *
 * ⚠️ TAB URL'DA (`?tab=`), komponent holatida emas: brauzer orqaga
 * tugmasi ishlashi va havola ulashilishi kerak.
 */

const TABS: Array<{ value: OrderTab; label: string }> = [
  { value: 'active', label: 'Faol' },
  { value: 'completed', label: 'Tugagan' },
  { value: 'cancelled', label: 'Bekor' },
];

const EMPTY_HINT: Record<OrderTab, { title: string; hint: string }> = {
  active: {
    title: "Faol buyurtma yo'q",
    hint: "Katalogdan tanlang — buyurtma to'g'ridan-to'g'ri do'konga boradi.",
  },
  completed: {
    title: "Tugagan buyurtma yo'q",
    hint: 'Yakunlangan buyurtmalar shu yerda qoladi.',
  },
  cancelled: { title: "Bekor qilingan buyurtma yo'q", hint: 'Va bu yaxshi.' },
  all: { title: "Buyurtma yo'q", hint: 'Katalogdan boshlang.' },
};

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Buyurtmalar — LookSave' }, { name: 'robots', content: 'noindex' }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const context = await requireAuth(request, locale);

  const raw = new URL(request.url).searchParams.get('tab');
  const tab: OrderTab = TABS.some((item) => item.value === raw) ? (raw as OrderTab) : 'active';

  const page = await getOrders(tab, context.options).catch(() => ({
    items: [] as OrderCard[],
    nextCursor: null,
    hasMore: false,
  }));

  return data(
    { locale: locale as Locale, tab, orders: page.items },
    context.setCookie ? { headers: { 'Set-Cookie': context.setCookie } } : undefined,
  );
}

export default function Orders({ loaderData }: Route.ComponentProps): JSX.Element {
  const { locale, tab, orders } = loaderData;
  const empty = EMPTY_HINT[tab];

  return (
    <div className="shell section-y">
      <h1 className="text-h1 font-bold">Buyurtmalar</h1>

      <div className="mt-6 flex gap-2" role="tablist">
        {TABS.map((item) => (
          <Link
            key={item.value}
            to={`/${locale}/orders?tab=${item.value}`}
            role="tab"
            aria-selected={item.value === tab}
            className={
              item.value === tab
                ? 'rounded-full border border-borderAccent bg-primarySoft px-3.5 py-1.5 text-small text-brand'
                : 'rounded-full border border-border bg-surface2 px-3.5 py-1.5 text-small text-muted-foreground transition-colors hover:bg-surface3 hover:text-foreground'
            }
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="mt-8">
        {orders.length === 0 ? (
          <Empty
            icon="orders"
            title={empty.title}
            hint={empty.hint}
            action={
              <Button asChild>
                <Link to={`/${locale}/catalog`}>Katalogga o'tish</Link>
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  to={`/${locale}/order/${order.id}`}
                  className="block focus-visible:outline-none"
                >
                  <Card interactive className="flex items-center gap-4 p-4">
                    <ImageFrame
                      src={order.preview.image}
                      alt=""
                      ratio="3/4"
                      rounded="md"
                      className="w-14 shrink-0"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-body font-bold tabular-nums">
                          {order.orderNumber}
                        </span>
                        <StatusBadge status={order.status} label={order.statusLabel} />
                      </div>

                      <p className="mt-1 truncate text-small text-muted-foreground">
                        {order.store.name}
                      </p>

                      <p className="truncate text-tiny text-dim">
                        {order.preview.title ?? 'Mahsulot'}
                        {order.itemCount > 1 ? ` +${order.itemCount - 1}` : ''}
                        {' · '}
                        {order.deliveryType === 'pickup' ? 'olib ketish' : 'yetkazish'}
                      </p>

                      {/* Javob muddati — faqat javob kutilayotgan buyurtmalarda */}
                      {order.status === 'new' || order.status === 'seen' ? (
                        <Deadline iso={order.expiresAt} className="mt-1" />
                      ) : null}
                    </div>

                    <span className="shrink-0 text-body font-bold tabular-nums text-brand">
                      {money(order.total, order.currency)}
                    </span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
