import type { StoreOrder } from '../../api/store';
import { countdown, money, phone as formatPhone, timeAgo } from '../../lib/format';
import { StatusBadge } from './StatusBadge';

interface Props {
  order: StoreOrder;
  busy: boolean;
  onSeen: () => void;
  onConfirm: () => void;
  onReject: () => void;
  onReady: () => void;
  onComplete: () => void;
  onNoShow: () => void;
}

function Trust({ trust }: { trust: StoreOrder['customerTrust'] }): JSX.Element {
  if (trust.completedOrders === 0 && trust.cancelledOrders === 0) {
    return <span className="text-limited">Birinchi buyurtma</span>;
  }
  return (
    <span className="text-muted">
      {trust.completedOrders} ta yakunlangan
      {trust.cancelledOrders > 0 ? ` · ${trust.cancelledOrders} bekor` : ' · 0 bekor'}
    </span>
  );
}

export function OrderCard(props: Props): JSX.Element {
  const { order, busy } = props;
  const timer = order.minutesLeft === null ? null : countdown(order.minutesLeft);

  return (
    <article className="card p-4 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-semibold text-white">{order.orderNumber}</span>
          <span className="text-xs text-dim">{timeAgo(order.createdAt)}</span>
        </div>
        <div className="flex items-center gap-2">
          {timer ? (
            <span
              className={`text-xs font-semibold tabular-nums ${timer.urgent ? 'text-danger' : 'text-muted'}`}
            >
              {timer.text}
            </span>
          ) : null}
          <StatusBadge status={order.status} />
        </div>
      </header>

      <div className="grid gap-4 py-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-white">{order.customer.name}</p>
          <a
            href={`tel:${order.customer.phone}`}
            className="block text-sm text-accent hover:underline"
          >
            {formatPhone(order.customer.phone)}
          </a>
          <p className="text-xs">
            <Trust trust={order.customerTrust} />
          </p>
        </div>

        <div className="space-y-1.5 text-sm">
          <p className="text-muted">
            {order.deliveryType === 'delivery' ? 'Yetkazib berish' : "Do'kondan olib ketadi"}
          </p>
          {order.address?.text ? (
            <>
              <p className="text-white">{order.address.text}</p>
              {order.address.landmark ? (
                <p className="text-xs text-dim">Mo'ljal: {order.address.landmark}</p>
              ) : null}
              {order.address.lat !== undefined && order.address.lng !== undefined ? (
                <a
                  className="inline-block text-xs text-accent hover:underline"
                  href={`https://maps.google.com/?q=${order.address.lat},${order.address.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Xaritada ochish
                </a>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <ul className="space-y-2 border-t border-border py-3">
        {order.items.map((item, index) => (
          <li key={`${item.title}-${item.size}-${index}`} className="flex justify-between text-sm">
            <span className="text-white">
              {item.title}
              <span className="text-dim">
                {' '}
                · {item.size} · {item.qty} dona
              </span>
            </span>
            <span className="tabular-nums text-muted">{money(item.unitPrice, order.currency)}</span>
          </li>
        ))}
      </ul>

      {order.note ? (
        <p className="rounded-xl bg-surface2 px-3 py-2 text-sm italic text-muted">“{order.note}”</p>
      ) : null}

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div>
          <p className="text-base font-bold text-white">{money(order.total, order.currency)}</p>
          <p className="text-xs text-dim">
            {order.paymentStatus === 'paid'
              ? "To'landi"
              : order.deliveryType === 'delivery'
                ? "To'lov yetkazilganda"
                : "To'lov do'konda"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {order.status === 'new' ? (
            <button type="button" className="btn-ghost" disabled={busy} onClick={props.onSeen}>
              Ko'rdim
            </button>
          ) : null}

          {(order.status === 'new' || order.status === 'seen') && (
            <>
              <button type="button" className="btn-danger" disabled={busy} onClick={props.onReject}>
                Rad etish
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={props.onConfirm}
              >
                Tasdiqlash
              </button>
            </>
          )}

          {order.status === 'confirmed' ? (
            <button type="button" className="btn-primary" disabled={busy} onClick={props.onReady}>
              Tayyor
            </button>
          ) : null}

          {order.status === 'ready' ? (
            <>
              <button type="button" className="btn-ghost" disabled={busy} onClick={props.onNoShow}>
                Mijoz kelmadi
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={props.onComplete}
              >
                Yakunlash
              </button>
            </>
          ) : null}
        </div>
      </footer>
    </article>
  );
}
