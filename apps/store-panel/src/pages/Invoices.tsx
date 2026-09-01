import { useQuery } from '@tanstack/react-query';
import { BadgeDollarSign, Gift, Receipt, ShoppingBag } from 'lucide-react';

import { getInvoices } from '../api/store';
import { EmptyState, ErrorState, Spinner } from '../components/Spinner';
import { PageHeader } from '../components/panel/PageHeader';
import { SectionCard } from '../components/panel/SectionCard';
import { StatTile } from '../components/panel/StatTile';
import { money } from '../lib/format';

const MONTHS = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentabr',
  'Oktabr',
  'Noyabr',
  'Dekabr',
];

function periodLabel(start: string): string {
  const [year, month] = start.split('-');
  const index = Number(month) - 1;
  return `${year} ${MONTHS[index] ?? month}`;
}

export function InvoicesPage(): JSX.Element {
  const invoices = useQuery({ queryKey: ['store', 'invoices'], queryFn: getInvoices });

  if (invoices.isLoading) return <Spinner />;
  if (invoices.isError) {
    return <ErrorState message="Yuklab bo'lmadi" onRetry={() => void invoices.refetch()} />;
  }

  const rows = invoices.data ?? [];

  /*
   * ⚠️ YIG'INDI MIJOZ TOMONIDA HISOBLANADI, chunki server uni bermaydi
   * (`GET /store/invoices` faqat davrlar ro'yxatini qaytaradi).
   * `Number` ga o'tkazish xavfsiz: summalar `NUMERIC(12,2)` va JS
   * butun sonlari 2^53 gacha aniq — 12 xonali so'm undan ancha kichik.
   */
  const totals = rows.reduce(
    (sum, invoice) => ({
      orders: sum.orders + invoice.ordersCount,
      gross: sum.gross + Number(invoice.grossAmount),
      commission: sum.commission + Number(invoice.commission),
    }),
    { orders: 0, gross: 0, commission: 0 },
  );

  const currency = rows[0]?.currency ?? 'UZS';
  const amount = (value: number): string => money(value.toFixed(2), currency);

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Hisoblar"
        subtitle="Har oy boshida o'tgan oy uchun hisob avtomatik tuziladi."
      />

      {/* K-12: Faza 1-2 da komissiya olinmaydi */}
      <div className="card flex items-start gap-3 border-primary/30 bg-primary/5 p-4">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20"
        >
          <Gift className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">Hozircha komissiya olinmaydi</p>
          <p className="mt-1 text-sm text-muted-foreground">
            LookSave dastlabki bosqichda bepul. Quyidagi raqamlar ma'lumot uchun — do'koningiz ilova
            orqali qancha buyurtma olganini ko'rsatadi.
          </p>
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile
            icon={ShoppingBag}
            tone="violet"
            label="Jami buyurtma"
            value={String(totals.orders)}
            hint={`${rows.length} ta davr`}
          />
          <StatTile
            icon={BadgeDollarSign}
            tone="green"
            label="Jami aylanma"
            value={amount(totals.gross)}
            hint="Yakunlangan buyurtmalar"
          />
          <StatTile
            icon={Receipt}
            tone="brand"
            label="Komissiya"
            value={totals.commission === 0 ? 'bepul' : amount(totals.commission)}
            hint="Faza 1-2 da olinmaydi"
          />
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Hisob hali yo'q"
          hint="Birinchi hisob keyingi oy boshida avtomatik tuziladi."
        />
      ) : (
        <SectionCard icon={Receipt} title="Davrlar" padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="thead">
                <tr>
                  <th>Davr</th>
                  <th className="text-right">Buyurtma</th>
                  <th className="text-right">Aylanma</th>
                  <th className="text-right">Komissiya</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((invoice) => (
                  <tr key={invoice.id} className="transition-colors hover:bg-surface2/40">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {periodLabel(invoice.periodStart)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {invoice.ordersCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {money(invoice.grossAmount, invoice.currency)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {invoice.isFree ? (
                        <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                          bepul
                        </span>
                      ) : (
                        <span className="text-foreground">
                          {money(invoice.commission, invoice.currency)}
                        </span>
                      )}
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
