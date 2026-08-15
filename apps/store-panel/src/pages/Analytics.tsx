import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getAnalytics, type Analytics } from '../api/store';
import { EmptyState, ErrorState, Spinner } from '../components/Spinner';
import { money } from '../lib/format';

const PERIODS = [7, 30, 90] as const;

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

/**
 * Kunlik ustunlar.
 *
 * ⚠️ Hujjatda Recharts ko'rsatilgan (07-web-panels §4.6). Bitta ustunli
 * grafik uchun ~100 KB kutubxona qo'shish o'zini oqlamaydi — CSS bilan
 * chizilgan. Bir nechta murakkab grafik kerak bo'lganda Recharts'ga
 * o'tamiz.
 */
function DailyChart({ daily }: { daily: Analytics['daily'] }): JSX.Element {
  const max = Math.max(1, ...daily.map((day) => day.orders));

  return (
    <div className="card p-4">
      <p className="label">Kunlik buyurtmalar</p>

      <div className="mt-4 flex h-32 items-end gap-[2px]">
        {daily.map((day) => (
          <div
            key={day.day}
            className="group relative flex-1 rounded-t bg-primary/30 transition hover:bg-primary"
            style={{ height: `${Math.max(2, (day.orders / max) * 100)}%` }}
          >
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-surface2 px-2 py-1 text-[11px] text-white group-hover:block">
              {day.day} · {day.orders} ta
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-dim">
        <span>{daily[0]?.day}</span>
        <span>{daily[daily.length - 1]?.day}</span>
      </div>
    </div>
  );
}

/** Past konversiya — mahsulotda muammo borligi belgisi. */
function conversionTone(value: number | null): string {
  if (value === null) return 'text-dim';
  if (value >= 5) return 'text-success';
  if (value >= 2) return 'text-muted';
  return 'text-warning';
}

export function AnalyticsPage(): JSX.Element {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);

  const analytics = useQuery({
    queryKey: ['store', 'analytics', days],
    queryFn: () => getAnalytics(days),
  });

  if (analytics.isLoading) return <Spinner />;
  if (analytics.isError || !analytics.data) {
    return <ErrorState message="Yuklab bo'lmadi" onRetry={() => void analytics.refetch()} />;
  }

  const { totals, daily, topProducts } = analytics.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-white">Statistika</h1>

        <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
          {PERIODS.map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setDays(period)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                days === period ? 'bg-primary text-white' : 'text-muted hover:text-white'
              }`}
            >
              {period} kun
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Ko'rishlar" value={String(totals.views)} hint="jami" />
        <Stat label="Kiyib ko'rish" value={String(totals.tryons)} hint={`${days} kun`} />
        <Stat
          label="Buyurtmalar"
          value={String(totals.orders)}
          hint={`${totals.completed} ta yakunlangan`}
        />
        <Stat label="Aylanma" value={money(totals.revenue, 'UZS')} hint="yakunlanganlar" />
      </div>

      <div className="card p-4">
        <p className="label">Kiyib ko'rish → buyurtma</p>
        <p className={`mt-2 text-2xl font-bold ${conversionTone(totals.conversion)}`}>
          {totals.conversion === null ? '—' : `${totals.conversion}%`}
        </p>
        <p className="mt-2 max-w-xl text-xs text-dim">
          Bu — do'kon uchun eng muhim raqam. Mahsulot ko'p kiyib ko'rilib kam sotib olinsa, sabab
          odatda uchtadan biri: narx yuqori, kerakli o'lcham yo'q yoki 3D model haqiqatga
          o'xshamaydi.
        </p>
      </div>

      <DailyChart daily={daily} />

      {topProducts.length === 0 ? (
        <EmptyState
          title="Hozircha ma'lumot yo'q"
          hint="Buyurtmalar kelgach shu yerda ko'rinadi."
        />
      ) : (
        <section className="card overflow-x-auto">
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-white">
            Mahsulotlar
          </h2>
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-dim">
                <th className="px-4 py-2.5 font-medium">Nomi</th>
                <th className="px-4 py-2.5 text-right font-medium">Ko'rish</th>
                <th className="px-4 py-2.5 text-right font-medium">Kiyib ko'rish</th>
                <th className="px-4 py-2.5 text-right font-medium">Buyurtma</th>
                <th className="px-4 py-2.5 text-right font-medium">Nisbat</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((product, index) => (
                <tr key={product.id} className={index % 2 === 0 ? 'bg-surface' : 'bg-surface2'}>
                  <td className="px-4 py-2.5 text-white">{product.title}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">
                    {product.views}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">
                    {product.tryons}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">
                    {product.orders}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right tabular-nums ${conversionTone(product.conversion)}`}
                  >
                    {product.conversion === null ? '—' : `${product.conversion}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
