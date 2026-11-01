import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, CircleX, Clock3 } from 'lucide-react';
import { useState } from 'react';

import {
  approveProduct,
  getModerationProducts,
  rejectProduct,
  setProductLimited,
  type ModerationProduct,
} from '../api/admin';
import { ReasonModal } from '../components/ReasonModal';
import { EmptyState, ErrorState, Spinner } from '../components/Spinner';
import { money } from '../lib/format';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TABS = [
  { value: 'pending', label: 'Moderatsiyada' },
  { value: 'rejected', label: 'Rad etilgan' },
  { value: 'active', label: 'Nashr qilingan' },
] as const;

const TAB_ICONS = { pending: Clock3, rejected: CircleX, active: CircleCheck } as const;

type Tab = (typeof TABS)[number]['value'];

export function ProductsPage(): JSX.Element {
  const [tab, setTab] = useState<Tab>('pending');
  const [rejecting, setRejecting] = useState<ModerationProduct | null>(null);
  const queryClient = useQueryClient();

  const products = useQuery({
    queryKey: ['admin', 'products', tab],
    queryFn: () => getModerationProducts(tab),
  });

  const act = useMutation({
    mutationFn: (task: () => Promise<unknown>) => task(),
    onSuccess: () => {
      setRejecting(null);
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });

  return (
    <div className="page-shell space-y-7">
      <div>
        <h1 className="page-title">Mahsulotlar</h1>
        <p className="page-copy">
          Rasmlar haqiqiy mahsulotnikimi, nom va narx mos keladimi, o'lchamlar to'g'rimi — shuni
          tekshiring.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList className="premium-tabs h-auto min-h-[70px] w-full justify-start gap-2 overflow-x-auto rounded-3xl border border-border bg-surface/70 p-2">
          {TABS.map((item) => {
            const TabIcon = TAB_ICONS[item.value];
            return (
            <TabsTrigger
              key={item.value}
              value={item.value}
              className="min-h-[52px] flex-1 gap-3 whitespace-nowrap rounded-2xl px-5 py-3 text-base data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand data-[state=active]:to-primary data-[state=active]:text-white"
            >
              <TabIcon className="h-5 w-5" />
              {item.label}
            </TabsTrigger>
          )})}
        </TabsList>
      </Tabs>

      {products.isLoading ? <Spinner /> : null}
      {products.isError ? (
        <ErrorState message="Yuklab bo'lmadi" onRetry={() => void products.refetch()} />
      ) : null}
      {products.data?.length === 0 ? (
        <EmptyState
          title="Bu ro'yxat bo'sh"
          hint="Do'kon mahsulotni tekshiruvga yuborganda shu yerda ko'rinadi."
        />
      ) : null}

      <div className="space-y-4">
        {products.data?.map((product) => (
          <article key={product.id} className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">{product.title}</h2>
                <p className="text-xs text-dim">
                  {product.store.name} · {product.categorySlug}
                  {product.brandName ? ` · ${product.brandName}` : ''}
                </p>
              </div>
              <p className="text-base font-bold tabular-nums text-foreground">
                {money(product.price, product.currency)}
              </p>
            </div>

            {product.images.length > 0 ? (
              <div className="mt-4 flex gap-2 overflow-x-auto">
                {product.images.map((url) => (
                  <img
                    key={url}
                    src={url}
                    alt=""
                    className="h-28 w-28 shrink-0 rounded-xl border border-border object-cover"
                  />
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-warning">Rasm yo'q — nashr qilib bo'lmaydi.</p>
            )}

            {product.description ? (
              <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                {product.description}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
              <span>{product.variantCount} rang</span>
              <span>{product.totalStock} dona ombor</span>
              <span>{product.gender}</span>
              <span>{new Date(product.createdAt).toLocaleDateString('uz-UZ')}</span>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              {/*
                LIMITED kolleksiyasi — faqat nashr qilingan mahsulotlar uchun.
                Admin ko'rganda ma'qul topgan premium mahsulotlargagina qo'yiladi;
                sotuvchi forma orqali o'zini "limited" qila olmaydi, aks holda
                belgi ma'nosini yo'qotardi.
              */}
              {product.status === 'active' ? (
                <Button
                  type="button"
                  variant={product.isLimited ? 'default' : 'outline'}
                  disabled={act.isPending}
                  onClick={() => act.mutate(() => setProductLimited(product.id, !product.isLimited))}
                >
                  {product.isLimited ? '★ LIMITED — bosilsa olinadi' : 'LIMITED kolleksiyaga qo`shish'}
                </Button>
              ) : <span />}

              <div className="flex gap-2">
                {product.status !== 'rejected' ? (
                  <Button
                    variant="destructive"
                    type="button"
                    disabled={act.isPending}
                    onClick={() => setRejecting(product)}
                  >
                    Rad etish
                  </Button>
                ) : null}
                {product.status !== 'active' ? (
                  <Button
                    type="button"
                    disabled={act.isPending || product.images.length === 0}
                    onClick={() => act.mutate(() => approveProduct(product.id))}
                  >
                    Nashr qilish
                  </Button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>

      {rejecting ? (
        <ReasonModal
          title="Mahsulotni rad etish"
          description={`"${rejecting.title}" katalogga chiqmaydi. Sabab do'konga ko'rsatiladi.`}
          actionLabel="Rad etish"
          busy={act.isPending}
          onCancel={() => setRejecting(null)}
          onSubmit={(reason) => act.mutate(() => rejectProduct(rejecting.id, reason))}
        />
      ) : null}
    </div>
  );
}
