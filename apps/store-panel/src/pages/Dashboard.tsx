import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { getDashboard } from '../api/store';
import { ErrorState, Spinner } from '../components/Spinner';
import { money } from '../lib/format';

function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'warning';
}): JSX.Element {
  return (
    <div className="card p-4">
      <p className="label">{label}</p>
      <p
        className={`mt-2 text-2xl font-bold ${tone === 'warning' ? 'text-warning' : 'text-foreground'}`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-dim">{hint}</p> : null}
    </div>
  );
}

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

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Bosh sahifa</h1>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Yangi"
          value={String(data.newOrders)}
          hint={data.newOrders > 0 ? 'Javob kutmoqda' : undefined}
          tone={data.newOrders > 0 ? 'warning' : 'default'}
        />
        <Stat label="Jarayonda" value={String(data.inProgress)} />
        <Stat label="Bu oy" value={String(data.completedMonth)} hint="Yakunlangan buyurtma" />
        <Stat label="Daromad" value={money(data.revenueMonth, data.currency)} hint="Shu oy" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <p className="label">Javob tezligi</p>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {data.avgResponseMin === null ? '—' : `${data.avgResponseMin} daqiqa`}
          </p>
          <p className={`mt-1 text-xs font-medium ${grade.className}`}>{grade.text}</p>
          <p className="mt-2 text-xs text-dim">
            Tez javob bergan do'kon qidiruvda yuqoriroq chiqadi.
          </p>
        </div>

        <div className="card p-4">
          <p className="label">Tasdiqlash foizi</p>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {data.confirmRate === null ? '—' : `${Math.round(data.confirmRate * 100)}%`}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface2">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.round((data.confirmRate ?? 0) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-dim">So'nggi 30 kun</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Mahsulotlar" value={String(data.productCount)} />
        <Stat label="3D bilan" value={String(data.product3dCount)} />
        <Stat
          label="3D kutilmoqda"
          value={String(data.pending3d)}
          tone={data.pending3d > 0 ? 'warning' : 'default'}
        />
      </div>

      {data.topProducts.length > 0 ? (
        <section className="card overflow-hidden">
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
            Ko'p buyurtma qilingan
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-dim">
                <th className="px-4 py-2 font-medium">Mahsulot</th>
                <th className="px-4 py-2 text-right font-medium">Buyurtma</th>
                <th className="px-4 py-2 text-right font-medium">Kiyib ko'rish</th>
              </tr>
            </thead>
            <tbody>
              {data.topProducts.map((product, index) => (
                <tr key={product.id} className={index % 2 === 0 ? 'bg-surface' : 'bg-surface2'}>
                  <td className="px-4 py-2.5 text-foreground">{product.title}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {product.orders}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {product.tryons}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {data.newOrders > 0 ? (
        <Link to="/orders" className="btn-primary w-full sm:w-auto">
          {data.newOrders} ta yangi buyurtmani ko'rish
        </Link>
      ) : null}
    </div>
  );
}
