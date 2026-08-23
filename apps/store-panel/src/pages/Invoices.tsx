import { useQuery } from '@tanstack/react-query';

import { getInvoices } from '../api/store';
import { EmptyState, ErrorState, Spinner } from '../components/Spinner';
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

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-xl font-semibold text-foreground">Hisoblar</h1>

      {/* K-12: Faza 1-2 da komissiya olinmaydi */}
      <div className="card border-primary/30 bg-primary/5 p-4">
        <p className="text-sm font-medium text-foreground">Hozircha komissiya olinmaydi</p>
        <p className="mt-1 text-sm text-muted-foreground">
          LookSave dastlabki bosqichda bepul. Quyidagi raqamlar ma'lumot uchun — do'koningiz ilova
          orqali qancha buyurtma olganini ko'rsatadi.
        </p>
      </div>

      {invoices.data?.length === 0 ? (
        <EmptyState
          title="Hisob hali yo'q"
          hint="Birinchi hisob keyingi oy boshida avtomatik tuziladi."
        />
      ) : null}

      {invoices.data && invoices.data.length > 0 ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-dim">
                <th className="px-4 py-2.5 font-medium">Davr</th>
                <th className="px-4 py-2.5 text-right font-medium">Buyurtma</th>
                <th className="px-4 py-2.5 text-right font-medium">Aylanma</th>
                <th className="px-4 py-2.5 text-right font-medium">Komissiya</th>
              </tr>
            </thead>
            <tbody>
              {invoices.data.map((invoice, index) => (
                <tr key={invoice.id} className={index % 2 === 0 ? 'bg-surface' : 'bg-surface2'}>
                  <td className="px-4 py-3 text-foreground">{periodLabel(invoice.periodStart)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {invoice.ordersCount}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {money(invoice.grossAmount, invoice.currency)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {invoice.isFree ? (
                      <span className="text-success">bepul</span>
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
      ) : null}
    </div>
  );
}
