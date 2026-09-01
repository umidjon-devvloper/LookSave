import { useQuery } from '@tanstack/react-query';
import { BarChart3, Eye, Package, ShoppingBag, Sparkles, Target, Wallet } from 'lucide-react';
import { useState } from 'react';

import { getAnalytics, type Analytics } from '../api/store';
import { EmptyState, ErrorState, Spinner } from '../components/Spinner';
import { Donut } from '../components/panel/Donut';
import { IconBadge } from '../components/panel/IconBadge';
import { PageHeader } from '../components/panel/PageHeader';
import { SectionCard } from '../components/panel/SectionCard';
import { Sparkline } from '../components/panel/Sparkline';
import { StatTile } from '../components/panel/StatTile';
import { money } from '../lib/format';

const PERIODS = [7, 30, 90] as const;

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
    <SectionCard icon={BarChart3} title="Kunlik buyurtmalar">
      <div className="flex h-32 items-end gap-[2px]">
        {daily.map((day) => (
          <div
            key={day.day}
            className="group relative flex-1 rounded-t bg-primary/30 transition hover:bg-primary"
            style={{ height: `${Math.max(2, (day.orders / max) * 100)}%` }}
          >
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-surface2 px-2 py-1 text-[11px] text-foreground group-hover:block">
              {day.day} · {day.orders} ta
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-dim">
        <span>{daily[0]?.day}</span>
        <span>{daily[daily.length - 1]?.day}</span>
      </div>
    </SectionCard>
  );
}

/** Past konversiya — mahsulotda muammo borligi belgisi. */
function conversionTone(value: number | null): string {
  if (value === null) return 'text-dim';
  if (value >= 5) return 'text-success';
  if (value >= 2) return 'text-muted-foreground';
  return 'text-warning';
}

/** Halqa rangi matn rangi bilan bir xil mantiqda — ikkalasi bir xil bahoni beradi. */
function conversionStroke(value: number | null): string {
  if (value === null) return 'stroke-dim';
  if (value >= 5) return 'stroke-success';
  if (value >= 2) return 'stroke-primary';
  return 'stroke-warning';
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
    <div className="space-y-6">
      <PageHeader
        title="Statistika"
        subtitle="Do'koningiz faoliyati haqida umumiy ma'lumot"
        action={
          <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
            {PERIODS.map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setDays(period)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  days === period
                    ? 'bg-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {period} kun
              </button>
            ))}
          </div>
        }
      />

      {/*
        ⚠️ SPARKLINE FAQAT «BUYURTMALAR» DA. Server kunlik qatorni faqat
        buyurtmalar uchun beradi (`daily: {day, orders, completed}`);
        ko'rish, kiyib ko'rish va aylanma bo'yicha faqat YIG'INDI bor.
        Qolgan uchtasiga chiziq qo'yish — ma'lumotni to'qib chiqarish
        bo'lardi. Ular uchun ham kerak bo'lsa, avval API kunlik qatorni
        qaytarishi kerak.
      */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={Eye}
          tone="violet"
          label="Ko'rishlar"
          value={String(totals.views)}
          hint="Jami"
        />
        <StatTile
          icon={Sparkles}
          tone="blue"
          label="Kiyib ko'rish"
          value={String(totals.tryons)}
          hint={`${days} kun`}
        />
        <StatTile
          icon={ShoppingBag}
          tone="green"
          label="Buyurtmalar"
          value={String(totals.orders)}
          hint={`${totals.completed} ta yakunlangan`}
          chart={<Sparkline values={daily.map((day) => day.orders)} />}
        />
        <StatTile
          icon={Wallet}
          tone="brand"
          label="Aylanma"
          value={money(totals.revenue, 'UZS')}
          hint="Yakunlanganlar"
        />
      </div>

      <div className="card flex items-start gap-4 p-4">
        <IconBadge icon={Target} tone="amber" />
        <div className="min-w-0 flex-1">
          <p className="label">Kiyib ko'rish → buyurtma</p>
          <p
            className={`mt-1 text-2xl font-bold leading-tight ${conversionTone(totals.conversion)}`}
          >
            {totals.conversion === null ? '—' : `${totals.conversion}%`}
          </p>
          <p className="mt-0.5 text-xs text-dim">Konversiya darajasi</p>
          <p className="mt-2 max-w-xl text-xs text-dim">
            Bu — do'kon uchun eng muhim raqam. Mahsulot ko'p kiyib ko'rilib kam sotib olinsa, sabab
            odatda uchtadan biri: narx yuqori, kerakli o'lcham yo'q yoki 3D model haqiqatga
            o'xshamaydi.
          </p>
        </div>
        <Donut percent={totals.conversion} tone={conversionStroke(totals.conversion)} />
      </div>

      <DailyChart daily={daily} />

      {topProducts.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Hozircha ma'lumot yo'q"
          hint="Buyurtmalar kelgach shu yerda ko'rinadi."
        />
      ) : (
        <SectionCard
          icon={Package}
          title="Mahsulotlar"
          description={`${topProducts.length} ta mahsulot · ${days} kun`}
          padded={false}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="thead">
                <tr>
                  <th>Nomi</th>
                  <th className="text-right">Ko'rish</th>
                  <th className="text-right">Kiyib ko'rish</th>
                  <th className="text-right">Buyurtma</th>
                  <th className="text-right">Nisbat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topProducts.map((product) => (
                  <tr key={product.id} className="transition-colors hover:bg-surface2/40">
                    <td className="px-4 py-3 font-medium text-foreground">{product.title}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {product.views}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {product.tryons}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {product.orders}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${conversionTone(product.conversion)}`}
                    >
                      {product.conversion === null ? '—' : `${product.conversion}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
