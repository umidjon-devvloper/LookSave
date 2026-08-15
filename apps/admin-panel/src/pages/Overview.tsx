import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { getOverview } from '../api/admin';
import { ErrorState, Spinner } from '../components/Spinner';

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}): JSX.Element {
  return (
    <div className="card p-4">
      <p className="label">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-dim">{hint}</p> : null}
    </div>
  );
}

export function OverviewPage(): JSX.Element {
  const overview = useQuery({ queryKey: ['admin', 'overview'], queryFn: getOverview });

  if (overview.isLoading) return <Spinner />;
  if (overview.isError || !overview.data) {
    return (
      <ErrorState message="Ma'lumotni yuklab bo'lmadi" onRetry={() => void overview.refetch()} />
    );
  }

  const data = overview.data;

  const attention: Array<{ text: string; to: string }> = [
    ...(data.stores.pending > 0
      ? [{ text: `${data.stores.pending} ta do'kon tasdiqlanmagan`, to: '/stores' }]
      : []),
    ...(data.moderation.productsPending > 0
      ? [{ text: `${data.moderation.productsPending} ta mahsulot moderatsiyada`, to: '/products' }]
      : []),
    ...(data.moderation.assetsQueued > 0
      ? [{ text: `${data.moderation.assetsQueued} ta 3D model navbatda`, to: '/3d' }]
      : []),
    ...(data.attention.globalBlocks > 0
      ? [{ text: `${data.attention.globalBlocks} ta raqam global blokda`, to: '/moderation' }]
      : []),
    ...(data.attention.restrictedUsers > 0
      ? [
          {
            text: `${data.attention.restrictedUsers} ta foydalanuvchi cheklangan`,
            to: '/moderation',
          },
        ]
      : []),
    ...(data.attention.silentStores > 0
      ? [
          {
            text: `${data.attention.silentStores} ta do'kon 24 soatdan beri javob bermayapti`,
            to: '/stores',
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-white">Umumiy holat</h1>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Do'konlar"
          value={String(data.stores.active)}
          hint={
            data.stores.pending > 0 ? `+${data.stores.pending} kutilmoqda` : 'hammasi ko\u2018rildi'
          }
        />
        <Stat
          label="Foydalanuvchilar"
          value={String(data.users.total)}
          hint={`+${data.users.newThisWeek} bu hafta`}
        />
        <Stat label="Buyurtmalar" value={String(data.ordersThisWeek)} hint="bu hafta" />
        <Stat
          label="3D navbat"
          value={String(data.moderation.assetsQueued + data.moderation.assetsProcessing)}
          hint={`${data.moderation.assetsProcessing} ta ishlanmoqda`}
        />
      </div>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-white">Diqqat talab qiladi</h2>
        {attention.length === 0 ? (
          <p className="mt-3 text-sm text-dim">
            Hozircha hammasi joyida. Yangi do'kon yoki mahsulot kelganda shu yerda ko'rinadi.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {attention.map((item) => (
              <li key={item.text}>
                <Link
                  to={item.to}
                  className="flex items-center gap-2 text-sm text-warning hover:underline"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                  {item.text}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
