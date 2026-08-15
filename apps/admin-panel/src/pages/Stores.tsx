import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  approveStore,
  getStores,
  rejectStore,
  suspendStore,
  type AdminStore,
  type StoreStatus,
} from '../api/admin';
import { ReasonModal } from '../components/ReasonModal';
import { EmptyState, ErrorState, Spinner } from '../components/Spinner';
import { phone as formatPhone } from '../lib/format';

const TABS: Array<{ value: StoreStatus; label: string }> = [
  { value: 'pending', label: 'Kutilmoqda' },
  { value: 'active', label: 'Faol' },
  { value: 'suspended', label: "To'xtatilgan" },
  { value: 'rejected', label: 'Rad etilgan' },
  { value: 'all', label: 'Barchasi' },
];

/** Javob tezligi — ilova sifatining asosiy ko'rsatkichi (07-web-panels §5.5). */
function responseTone(minutes: number | null): string {
  if (minutes === null) return 'text-dim';
  if (minutes < 15) return 'text-success';
  if (minutes < 60) return 'text-warning';
  return 'text-danger';
}

function StoreCard({
  store,
  busy,
  onApprove,
  onReject,
  onSuspend,
}: {
  store: AdminStore;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onSuspend: () => void;
}): JSX.Element {
  return (
    <article className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {store.logoUrl ? (
            <img
              src={store.logoUrl}
              alt=""
              className="h-11 w-11 rounded-xl border border-border object-cover"
            />
          ) : (
            <div className="h-11 w-11 rounded-xl border border-dashed border-borderStrong" />
          )}
          <div>
            <h2 className="font-semibold text-white">{store.name}</h2>
            <p className="text-xs text-dim">
              {store.city}, {store.country} ·{' '}
              {new Date(store.createdAt).toLocaleDateString('uz-UZ')}
            </p>
          </div>
        </div>
        <span className="text-xs text-muted">{store.status}</span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="label">Egasi</dt>
          <dd className="mt-1 text-white">{store.owner.name ?? '—'}</dd>
          <dd>
            <a href={`tel:${store.owner.phone}`} className="text-accent hover:underline">
              {formatPhone(store.owner.phone)}
            </a>
          </dd>
        </div>
        <div>
          <dt className="label">Manzil</dt>
          <dd className="mt-1 text-white">{store.address}</dd>
          <dd>
            <a
              className="text-accent hover:underline"
              href={`https://maps.google.com/?q=${store.location.lat},${store.location.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              Xaritada tekshirish
            </a>
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-3 text-xs">
        <span className="text-muted">
          {store.productCount} mahsulot · {store.orderCount} buyurtma
        </span>
        <span className={responseTone(store.avgResponseMin)}>
          javob: {store.avgResponseMin === null ? '—' : `${store.avgResponseMin} daq`}
        </span>
        <span className="text-muted">
          tasdiq: {store.confirmRate === null ? '—' : `${Math.round(store.confirmRate * 100)}%`}
        </span>
      </div>

      {store.rejectReason ? (
        <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
          {store.rejectReason}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {store.status === 'pending' ? (
          <button type="button" className="btn-danger" disabled={busy} onClick={onReject}>
            Rad etish
          </button>
        ) : null}
        {store.status === 'active' ? (
          <button type="button" className="btn-ghost" disabled={busy} onClick={onSuspend}>
            To'xtatish
          </button>
        ) : null}
        {store.status !== 'active' ? (
          <button type="button" className="btn-primary" disabled={busy} onClick={onApprove}>
            {store.status === 'pending' ? 'Tasdiqlash' : 'Qayta faollashtirish'}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function StoresPage(): JSX.Element {
  const [tab, setTab] = useState<StoreStatus>('pending');
  const [modal, setModal] = useState<{ store: AdminStore; action: 'reject' | 'suspend' } | null>(
    null,
  );
  const queryClient = useQueryClient();

  const stores = useQuery({ queryKey: ['admin', 'stores', tab], queryFn: () => getStores(tab) });

  const act = useMutation({
    mutationFn: (task: () => Promise<unknown>) => task(),
    onSuccess: () => {
      setModal(null);
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">Do'konlar</h1>
        <p className="mt-1 text-sm text-dim">
          Tasdiqlashdan oldin tekshiring: manzil xaritada haqiqiymi, telefon ishlaydimi, nom va logo
          mos keladimi.
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === item.value ? 'bg-primary text-white' : 'text-muted hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {act.isError ? (
        <p className="text-sm text-danger">
          {act.error instanceof Error ? act.error.message : 'Amal bajarilmadi'}
        </p>
      ) : null}

      {stores.isLoading ? <Spinner /> : null}
      {stores.isError ? (
        <ErrorState message="Yuklab bo'lmadi" onRetry={() => void stores.refetch()} />
      ) : null}
      {stores.data?.length === 0 ? (
        <EmptyState title="Bu ro'yxat bo'sh" hint="Yangi ariza kelganda shu yerda ko'rinadi." />
      ) : null}

      <div className="space-y-4">
        {stores.data?.map((store) => (
          <StoreCard
            key={store.id}
            store={store}
            busy={act.isPending}
            onApprove={() => act.mutate(() => approveStore(store.id))}
            onReject={() => setModal({ store, action: 'reject' })}
            onSuspend={() => setModal({ store, action: 'suspend' })}
          />
        ))}
      </div>

      {modal ? (
        <ReasonModal
          title={modal.action === 'reject' ? "Do'konni rad etish" : "Do'konni to'xtatish"}
          description={
            modal.action === 'reject'
              ? `${modal.store.name} arizasi rad etiladi va sabab egasiga ko'rsatiladi.`
              : `${modal.store.name} katalogdan olib qo'yiladi. Mahsulotlari ko'rinmay qoladi.`
          }
          actionLabel={modal.action === 'reject' ? 'Rad etish' : "To'xtatish"}
          busy={act.isPending}
          onCancel={() => setModal(null)}
          onSubmit={(reason) =>
            act.mutate(() =>
              modal.action === 'reject'
                ? rejectStore(modal.store.id, reason)
                : suspendStore(modal.store.id, reason),
            )
          }
        />
      ) : null}
    </div>
  );
}
