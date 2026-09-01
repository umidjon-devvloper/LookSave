import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, Inbox, ShoppingBag } from 'lucide-react';
import { useState } from 'react';

import {
  completeOrder,
  confirmOrder,
  getDashboard,
  getOrders,
  markReady,
  markSeen,
  rejectOrder,
  reportNoShow,
  type OrderTab,
  type RejectReason,
  type StoreOrder,
} from '../api/store';
import { EmptyState, ErrorState, Spinner } from '../components/Spinner';
import { OrderCard } from '../components/orders/OrderCard';
import { RejectModal } from '../components/orders/RejectModal';
import { PageHeader } from '../components/panel/PageHeader';
import { StatTile } from '../components/panel/StatTile';

const TABS: Array<{ value: OrderTab; label: string }> = [
  { value: 'new', label: 'Yangi' },
  { value: 'active', label: 'Jarayonda' },
  { value: 'completed', label: 'Yakunlangan' },
  { value: 'cancelled', label: 'Rad etilgan' },
];

const EMPTY: Record<OrderTab, { title: string; hint: string }> = {
  new: {
    title: 'Yangi buyurtma yo‘q',
    hint: 'Buyurtma kelganda shu yerda darhol paydo bo‘ladi va Telegramga xabar boradi.',
  },
  active: {
    title: 'Jarayondagi buyurtma yo‘q',
    hint: 'Tasdiqlangan buyurtmalar shu yerda turadi.',
  },
  completed: { title: 'Hali yakunlangan buyurtma yo‘q', hint: '' },
  cancelled: { title: 'Rad etilgan buyurtma yo‘q', hint: '' },
};

export function OrdersPage(): JSX.Element {
  const [tab, setTab] = useState<OrderTab>('new');
  const [rejecting, setRejecting] = useState<StoreOrder | null>(null);
  const queryClient = useQueryClient();

  const orders = useQuery({
    queryKey: ['store', 'orders', tab],
    queryFn: () => getOrders(tab),
    refetchInterval: 60_000,
  });

  /*
   * ⚠️ QO'SHIMCHA SO'ROV EMAS. Kalit bosh sahifadagi bilan bir xil
   * (`['store','dashboard']`), ya'ni react-query keshdan beradi.
   * Sanoqlarni buyurtmalar ro'yxatidan hisoblab bo'lmaydi: ro'yxat
   * faqat OCHIQ ilovadagi ko'rinishni qaytaradi va boshqa ilovadagi
   * buyurtmalar soni u yerda yo'q.
   */
  const dashboard = useQuery({ queryKey: ['store', 'dashboard'], queryFn: getDashboard });

  const act = useMutation({
    mutationFn: (task: () => Promise<unknown>) => task(),
    onSuccess: () => {
      setRejecting(null);
      void queryClient.invalidateQueries({ queryKey: ['store'] });
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Buyurtmalar"
        subtitle="Tez javob bergan do'kon qidiruvda yuqoriroq chiqadi."
        action={
          act.isError ? (
            <p className="text-sm text-danger">
              {act.error instanceof Error ? act.error.message : 'Amal bajarilmadi'}
            </p>
          ) : undefined
        }
      />

      {dashboard.data ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile
            icon={ShoppingBag}
            tone="violet"
            label="Yangi"
            value={String(dashboard.data.newOrders)}
            hint={dashboard.data.newOrders > 0 ? 'Javob kutmoqda' : 'Hammasiga javob berilgan'}
            alert={dashboard.data.newOrders > 0}
          />
          <StatTile
            icon={Clock}
            tone="blue"
            label="Jarayonda"
            value={String(dashboard.data.inProgress)}
            hint="Tasdiqlangan, hali topshirilmagan"
          />
          <StatTile
            icon={CheckCircle2}
            tone="green"
            label="Bu oy"
            value={String(dashboard.data.completedMonth)}
            hint="Yakunlangan buyurtma"
          />
        </div>
      ) : null}

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === item.value
                ? 'bg-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {orders.isLoading ? <Spinner /> : null}

      {orders.isError ? (
        <ErrorState message="Buyurtmalarni yuklab bo'lmadi" onRetry={() => void orders.refetch()} />
      ) : null}

      {orders.data?.length === 0 ? (
        <EmptyState icon={Inbox} title={EMPTY[tab].title} hint={EMPTY[tab].hint} />
      ) : null}

      <div className="space-y-4">
        {orders.data?.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            busy={act.isPending}
            onSeen={() => act.mutate(() => markSeen(order.id))}
            onConfirm={() => act.mutate(() => confirmOrder(order.id))}
            onReject={() => setRejecting(order)}
            onReady={() => act.mutate(() => markReady(order.id))}
            onComplete={() => act.mutate(() => completeOrder(order.id, 'cash'))}
            onNoShow={() => act.mutate(() => reportNoShow(order.id, false))}
          />
        ))}
      </div>

      {rejecting ? (
        <RejectModal
          customerPhone={rejecting.customer.phone}
          busy={act.isPending}
          onCancel={() => setRejecting(null)}
          onSubmit={(input: { reason: RejectReason; comment?: string; blockPhone: boolean }) =>
            act.mutate(() => rejectOrder(rejecting.id, input))
          }
        />
      ) : null}
    </div>
  );
}
