import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, Package } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import {
  archiveProduct,
  getStoreProducts,
  type ProductStatus,
  type StoreProduct,
} from '../api/products';
import { getDashboard } from '../api/store';
import { EmptyState, ErrorState, Spinner } from '../components/Spinner';
import { PageHeader } from '../components/panel/PageHeader';
import { SectionCard } from '../components/panel/SectionCard';
import { StatTile } from '../components/panel/StatTile';
import { money } from '../lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TABS: Array<{ value: ProductStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Barchasi' },
  { value: 'active', label: 'Sotuvda' },
  { value: 'draft', label: 'Qoralama' },
  { value: 'pending', label: 'Tekshiruvda' },
  { value: 'rejected', label: 'Rad etilgan' },
  { value: 'archived', label: 'Arxiv' },
];

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  draft: { text: 'Qoralama', className: 'text-dim' },
  pending: { text: 'Tekshiruvda', className: 'text-warning' },
  active: { text: 'Sotuvda', className: 'text-success' },
  rejected: { text: 'Rad etilgan', className: 'text-danger' },
  archived: { text: 'Arxiv', className: 'text-dim' },
};

function ProductRow({
  product,
  busy,
  onArchive,
}: {
  product: StoreProduct;
  busy: boolean;
  onArchive: () => void;
}): JSX.Element {
  const status = STATUS_LABEL[product.status] ?? {
    text: product.status,
    className: 'text-muted-foreground',
  };

  return (
    <tr className="transition-colors hover:bg-surface2/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {product.image ? (
            <img
              src={product.image}
              alt=""
              className="h-11 w-11 shrink-0 rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="h-11 w-11 shrink-0 rounded-lg border border-dashed border-borderStrong" />
          )}
          <div className="min-w-0">
            <Link
              to={`/products/${product.id}`}
              className="block truncate font-medium text-foreground hover:text-brand"
            >
              {product.title}
            </Link>
            <p className="text-xs text-dim">{product.category.name}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 tabular-nums text-muted-foreground">
        {money(product.price, product.currency)}
      </td>
      <td className="px-4 py-3 tabular-nums">
        <span className={product.stock.available === 0 ? 'text-danger' : 'text-muted-foreground'}>
          {product.stock.available}
        </span>
        {product.stock.reserved > 0 ? (
          <span className="text-xs text-dim"> ({product.stock.reserved} band)</span>
        ) : null}
      </td>
      {/*
        ⚠️ ILGARI BU YERDA «3D so'rash» TUGMASI TURARDI. Sotuvchi har
        mahsulot uchun 3D model buyurtma qilardi, keyin uning navbatda
        turishini kutardi — mahsulot esa shu vaqt ichida ilovada kiyib
        ko'rilmasdi.

        Endi kutiladigan narsa yo'q: kiyintirish mahsulot SURATIDAN AI
        orqali bo'ladi, ya'ni sotuvchi rasm va o'lchamlarni kiritishi
        bilan mahsulot tayyor.
      */}
      <td className="px-4 py-3 text-xs">
        {product.canTryOn ? (
          <span className="text-success">tayyor</span>
        ) : (
          <span className="text-dim">—</span>
        )}
      </td>
      <td className={`px-4 py-3 text-xs ${status.className}`}>{status.text}</td>
      <td className="px-4 py-3 text-right">
        {product.status !== 'archived' ? (
          <button
            type="button"
            className="text-sm text-dim hover:text-danger disabled:opacity-50"
            disabled={busy}
            onClick={onArchive}
          >
            Arxivlash
          </button>
        ) : null}
      </td>
    </tr>
  );
}

export function ProductsPage(): JSX.Element {
  const [tab, setTab] = useState<ProductStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const products = useQuery({
    queryKey: ['store', 'products', tab, search],
    queryFn: () => getStoreProducts(tab, search),
  });

  /*
   * ⚠️ SANOQLAR RO'YXATDAN EMAS, BOSH SAHIFA SO'ROVIDAN. Ro'yxat
   * tanlangan ilova va qidiruv bo'yicha filtrlangan — undan «jami
   * mahsulot» chiqmaydi. Kalit bosh sahifadagi bilan bir xil, ya'ni
   * keshdan keladi.
   */
  const dashboard = useQuery({ queryKey: ['store', 'dashboard'], queryFn: getDashboard });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['store', 'products'] });
  };

  const archive = useMutation({ mutationFn: archiveProduct, onSuccess: invalidate });
  const busy = archive.isPending;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mahsulotlar"
        subtitle="Kiyim surati va o`lchamlari kiritilgan mahsulot ilovada kiyib ko`riladi va ko`proq buyurtma oladi."
        action={
          /* ⚠️ `className="btn-primary"` EMAS: bunday sinf hech qayerda
             ta'riflanmagan va tugma bo'yalmagan matn bo'lib qolardi.
             `asChild` shadcn `Button` uslubini `Link` ga o'tkazadi. */
          <Button asChild>
            <Link to="/products/new">Mahsulot qo'shish</Link>
          </Button>
        }
      />

      {/*
        ⚠️ «3D KUTILMOQDA» PLITKASI OLIB TASHLANDI. U navbatdagi 3D
        modellarni sanardi — endi navbat yo'q, sotuvchi hech narsa
        kutmaydi. Turgan joyida u sotuvchini «nimadir tayyor bo'lishi
        kerak» degan fikrga solardi.
      */}
      {dashboard.data ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <StatTile
            icon={Package}
            tone="violet"
            label="Jami mahsulot"
            value={String(dashboard.data.productCount)}
          />
          <StatTile
            icon={Boxes}
            tone="blue"
            label="Kiyib ko'rish mumkin"
            value={String(dashboard.data.tryonReadyCount)}
            hint="AI shu mahsulotlarni kiydiradi"
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1">
          {TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setTab(item.value)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === item.value
                  ? 'bg-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <Input
          className="sm:w-64"
          placeholder="Nomi bo'yicha qidirish"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {products.isLoading ? <Spinner /> : null}
      {products.isError ? (
        <ErrorState
          message="Mahsulotlarni yuklab bo'lmadi"
          onRetry={() => void products.refetch()}
        />
      ) : null}

      {products.data?.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Mahsulot yo'q"
          hint="Birinchi mahsulotni qo'shing — u tekshiruvdan o'tgach katalogda ko'rinadi."
        />
      ) : null}

      {products.data && products.data.length > 0 ? (
        <SectionCard
          icon={Package}
          title="Ro'yxat"
          description={`${products.data.length} ta mahsulot`}
          padded={false}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="thead">
                <tr>
                  <th>Mahsulot</th>
                  <th>Narx</th>
                  <th>Ombor</th>
                  <th>Kiyib ko'rish</th>
                  <th>Holat</th>
                  <th />
                </tr>
              </thead>
              {/* `divide-y` — qatorlar orasidagi chiziq. `tr` ga `border-t`
                  qo'yilsa birinchi qator `.thead` chizig'i bilan qo'shilib
                  ikki barobar qalin ko'rinardi. */}
              <tbody className="divide-y divide-border">
                {products.data.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    busy={busy}
                    onArchive={() => archive.mutate(product.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
