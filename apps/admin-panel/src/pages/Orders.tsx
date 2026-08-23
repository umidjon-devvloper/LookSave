import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getOrderEvents, getOrders, type AdminOrderStatus } from '../api/admin';
import { EmptyState, ErrorState, Spinner } from '../components/Spinner';
import { money, phone as formatPhone } from '../lib/format';
import { Input } from '@/components/ui/input';

const TABS: Array<{ value: AdminOrderStatus; label: string }> = [
  { value: 'all', label: 'Barchasi' },
  { value: 'new', label: 'Yangi' },
  { value: 'confirmed', label: 'Tasdiqlangan' },
  { value: 'completed', label: 'Yakunlangan' },
  { value: 'rejected', label: 'Rad etilgan' },
  { value: 'expired', label: 'Javobsiz' },
];

const STATUS_TONE: Record<string, string> = {
  new: 'text-warning',
  seen: 'text-muted-foreground',
  confirmed: 'text-brand',
  ready: 'text-success',
  completed: 'text-success',
  rejected: 'text-danger',
  cancelled: 'text-dim',
  expired: 'text-danger',
};

/** Status tarixi — nizolarni hal qilishda kim nima qilganini ko'rsatadi. */
function EventList({ orderId }: { orderId: string }): JSX.Element {
  const events = useQuery({
    queryKey: ['admin', 'order-events', orderId],
    queryFn: () => getOrderEvents(orderId),
  });

  if (events.isLoading) return <Spinner label="Tarix yuklanmoqda" />;
  if (events.isError || !events.data) return <p className="text-sm text-danger">Yuklab bo'lmadi</p>;

  return (
    <ol className="mt-3 space-y-2 border-t border-border pt-3">
      {events.data.map((event, index) => (
        <li key={`${event.toStatus}-${index}`} className="flex flex-wrap gap-2 text-xs">
          <span className="text-dim">{new Date(event.createdAt).toLocaleString('uz-UZ')}</span>
          <span className="text-foreground">
            {event.fromStatus ? `${event.fromStatus} → ` : ''}
            {event.toStatus}
          </span>
          <span className="text-muted-foreground">
            {event.actorType}
            {event.channel ? ` · ${event.channel}` : ''}
          </span>
          {event.comment ? <span className="text-dim">“{event.comment}”</span> : null}
        </li>
      ))}
    </ol>
  );
}

export function OrdersPage(): JSX.Element {
  const [status, setStatus] = useState<AdminOrderStatus>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const orders = useQuery({
    queryKey: ['admin', 'orders', status, search],
    queryFn: () => getOrders(status, search),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Buyurtmalar</h1>
        <p className="mt-1 text-sm text-dim">
          Nizo bo'lganda buyurtma raqami yoki mijoz telefoni bo'yicha qidiring — status tarixida kim
          nima qilgani ko'rinadi.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatus(tab.value)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                status === tab.value
                  ? 'bg-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Input
          className="sm:w-64"
          placeholder="LS-260812-0043 yoki telefon"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {orders.isLoading ? <Spinner /> : null}
      {orders.isError ? (
        <ErrorState message="Yuklab bo'lmadi" onRetry={() => void orders.refetch()} />
      ) : null}
      {orders.data?.length === 0 ? (
        <EmptyState
          title="Buyurtma topilmadi"
          hint={search.length > 0 ? "So'rovni tekshiring." : undefined}
        />
      ) : null}

      <div className="space-y-3">
        {orders.data?.map((order) => (
          <article key={order.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-semibold text-foreground">
                  {order.orderNumber}
                </p>
                <p className="text-xs text-dim">
                  {order.store.name} · {new Date(order.createdAt).toLocaleString('uz-UZ')}
                </p>
              </div>
              <span className={`text-xs ${STATUS_TONE[order.status] ?? 'text-muted-foreground'}`}>
                {order.status}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <span className="text-foreground">{order.customer.name}</span>
              <a href={`tel:${order.customer.phone}`} className="text-brand hover:underline">
                {formatPhone(order.customer.phone)}
              </a>
              <span className="text-muted-foreground">
                {order.itemCount} ta · {money(order.total, order.currency)}
              </span>
              <span className="text-dim">
                {order.deliveryType === 'delivery' ? 'yetkazish' : 'olib ketish'}
              </span>
            </div>

            {order.reason ? (
              <p className="mt-2 text-xs text-danger">Sabab: {order.reason}</p>
            ) : null}

            <button
              type="button"
              className="mt-3 text-sm text-brand hover:underline"
              onClick={() => setExpanded(expanded === order.id ? null : order.id)}
            >
              {expanded === order.id ? 'Tarixni yopish' : 'Status tarixi'}
            </button>

            {expanded === order.id ? <EventList orderId={order.id} /> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
