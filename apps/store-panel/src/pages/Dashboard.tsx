import { useQuery } from '@tanstack/react-query';
import {
  Boxes,
  CheckCircle2,
  Clock,
  Package,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { getDashboard } from '../api/store';
import { ErrorState, Spinner } from '../components/Spinner';
import { IconBadge } from '../components/panel/IconBadge';
import { PageHeader } from '../components/panel/PageHeader';
import { SectionCard } from '../components/panel/SectionCard';
import { StatTile } from '../components/panel/StatTile';
import { money } from '../lib/format';
import { Button } from '@/components/ui/button';

/** Javob tezligi qidiruv reytingiga ta'sir qiladi — shuning uchun yuqorida. */
function responseGrade(minutes: number | null): { text: string; className: string } {
  if (minutes === null) return { text: "Ma'lumot yo'q", className: 'text-dim' };
  if (minutes < 15) return { text: 'Yaxshi', className: 'text-success' };
  if (minutes < 60) return { text: "O'rtacha", className: 'text-warning' };
  return { text: 'Sekin', className: 'text-danger' };
}

export function DashboardPage(): JSX.Element {
  const dashboard = useQuery({ queryKey: ['store', 'dashboard'], queryFn: getDashboard });

  if (dashboard.isLoading) return <Spinner />;
  if (dashboard.isError || !dashboard.data) {
    return (
      <ErrorState message="Ma'lumotni yuklab bo'lmadi" onRetry={() => void dashboard.refetch()} />
    );
  }

  const data = dashboard.data;
  const grade = responseGrade(data.avgResponseMin);
  const confirmPercent = data.confirmRate === null ? null : Math.round(data.confirmRate * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bosh sahifa"
        subtitle="Do'koningiz faoliyati haqida umumiy ma'lumot"
        action={
          data.newOrders > 0 ? (
            <Button asChild>
              <Link to="/orders">{data.newOrders} ta yangi buyurtma</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={ShoppingBag}
          tone="violet"
          label="Yangi"
          value={String(data.newOrders)}
          hint={data.newOrders > 0 ? 'Javob kutmoqda' : 'Bugun'}
          alert={data.newOrders > 0}
        />
        <StatTile
          icon={Clock}
          tone="blue"
          label="Jarayonda"
          value={String(data.inProgress)}
          hint="Bugun"
        />
        <StatTile
          icon={CheckCircle2}
          tone="green"
          label="Bu oy"
          value={String(data.completedMonth)}
          hint="Yakunlangan buyurtma"
        />
        <StatTile
          icon={Wallet}
          tone="brand"
          label="Daromad"
          value={money(data.revenueMonth, data.currency)}
          hint="Shu oy"
        />
      </div>

      {/*
        ⚠️ BU IKKISI `StatTile` EMAS. Ular raqamdan tashqari BAHO beradi
        («Yaxshi», progress chizig'i), ya'ni plitkaga sig'maydigan qo'shimcha
        mazmun bor. `IconBadge` umumiy — ko'rinish plitkalar bilan bir xil
        bo'lib qoladi.
      */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card flex items-start gap-3 p-4">
          <IconBadge icon={Zap} tone="violet" />
          <div className="min-w-0 flex-1">
            <p className="label">Javob tezligi</p>
            <p className="mt-1 text-2xl font-bold leading-tight tabular-nums text-foreground">
              {data.avgResponseMin === null ? '—' : `${data.avgResponseMin} daqiqa`}
            </p>
            <p className={`mt-0.5 text-xs font-medium ${grade.className}`}>{grade.text}</p>
            <p className="mt-2 text-xs text-dim">
              Tez javob bergan do'kon qidiruvda yuqoriroq chiqadi.
            </p>
          </div>
        </div>

        <div className="card flex items-start gap-3 p-4">
          <IconBadge icon={ShieldCheck} tone="blue" />
          <div className="min-w-0 flex-1">
            <p className="label">Tasdiqlash foizi</p>
            <p className="mt-1 text-2xl font-bold leading-tight tabular-nums text-foreground">
              {confirmPercent === null ? '—' : `${confirmPercent}%`}
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface3">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${confirmPercent ?? 0}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-dim">So'nggi 30 kun</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          icon={Package}
          tone="violet"
          label="Mahsulotlar"
          value={String(data.productCount)}
          hint="Jami mahsulot"
        />
        {/*
          ⚠️ ILGARI SHU YERDA IKKI «3D» PLITKASI TURARDI — «3D bilan» va
          «3D kutilmoqda». Ular sotuvchiga navbatni ko'rsatardi. Endi
          navbat yo'q: kiyintirish mahsulot suratidan AI orqali bo'ladi,
          shuning uchun bitta plitka qoldi — nechta mahsulot kiyib
          ko'rishga yaroqli.
        */}
        <StatTile
          icon={Boxes}
          tone="blue"
          label="Kiyib ko'rish mumkin"
          value={String(data.tryonReadyCount)}
          hint="AI shu mahsulotlarni kiydiradi"
        />
      </div>

      {data.topProducts.length > 0 ? (
        <SectionCard icon={TrendingUp} title="Ko'p buyurtma qilingan mahsulotlar" padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="thead">
                <tr>
                  <th>Mahsulot</th>
                  <th className="text-right">Buyurtma</th>
                  <th className="text-right">Kiyib ko'rish</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.topProducts.map((product) => (
                  <tr key={product.id} className="transition-colors hover:bg-surface2/40">
                    <td className="px-4 py-3">
                      <Link
                        to={`/products/${product.id}`}
                        className="font-medium text-foreground hover:text-brand"
                      >
                        {product.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {product.orders}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {product.tryons}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
