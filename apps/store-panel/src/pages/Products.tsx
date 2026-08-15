import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import {
  archiveProduct,
  getStoreProducts,
  request3d,
  type ProductStatus,
  type StoreProduct,
} from '../api/products';
import { EmptyState, ErrorState, Spinner } from '../components/Spinner';
import { money } from '../lib/format';

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

const ASSET_LABEL: Record<string, string> = {
  queued: 'navbatda',
  processing: 'tayyorlanmoqda',
  ready: 'tayyor',
  failed: 'xato',
  none: '—',
};

function ProductRow({
  product,
  busy,
  onArchive,
  onRequest3d,
}: {
  product: StoreProduct;
  busy: boolean;
  onArchive: () => void;
  onRequest3d: () => void;
}): JSX.Element {
  const status = STATUS_LABEL[product.status] ?? { text: product.status, className: 'text-muted' };

  return (
    <tr className="border-t border-border">
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
              className="block truncate font-medium text-white hover:text-accent"
            >
              {product.title}
            </Link>
            <p className="text-xs text-dim">{product.category.name}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 tabular-nums text-muted">
        {money(product.price, product.currency)}
      </td>
      <td className="px-4 py-3 tabular-nums">
        <span className={product.stock.available === 0 ? 'text-danger' : 'text-muted'}>
          {product.stock.available}
        </span>
        {product.stock.reserved > 0 ? (
          <span className="text-xs text-dim"> ({product.stock.reserved} band)</span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-xs">
        {product.has3d ? (
          <span className="text-success">tayyor</span>
        ) : product.assetStatus ? (
          <span className="text-muted">
            {ASSET_LABEL[product.assetStatus] ?? product.assetStatus}
          </span>
        ) : (
          <button
            type="button"
            className="text-accent hover:underline disabled:opacity-50"
            disabled={busy}
            onClick={onRequest3d}
          >
            3D so'rash
          </button>
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

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['store', 'products'] });
  };

  const archive = useMutation({ mutationFn: archiveProduct, onSuccess: invalidate });
  const ask3d = useMutation({ mutationFn: request3d, onSuccess: invalidate });
  const busy = archive.isPending || ask3d.isPending;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-white">Mahsulotlar</h1>
        <Link to="/products/new" className="btn-primary">
          Mahsulot qo'shish
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1">
          {TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setTab(item.value)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === item.value ? 'bg-primary text-white' : 'text-muted hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <input
          className="field sm:w-64"
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
          title="Mahsulot yo'q"
          hint="Birinchi mahsulotni qo'shing — u tekshiruvdan o'tgach katalogda ko'rinadi."
        />
      ) : null}

      {products.data && products.data.length > 0 ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-dim">
                <th className="px-4 py-2.5 font-medium">Mahsulot</th>
                <th className="px-4 py-2.5 font-medium">Narx</th>
                <th className="px-4 py-2.5 font-medium">Ombor</th>
                <th className="px-4 py-2.5 font-medium">3D</th>
                <th className="px-4 py-2.5 font-medium">Holat</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {products.data.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  busy={busy}
                  onArchive={() => archive.mutate(product.id)}
                  onRequest3d={() => ask3d.mutate(product.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
