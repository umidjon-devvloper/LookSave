import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiClientError } from '../api/client';
import {
  getStoreProduct,
  updateProduct,
  updateStock,
  type StoreProductDetail,
} from '../api/products';
import { ErrorState, Spinner } from '../components/Spinner';
import { ImageUploader } from '../components/products/ImageUploader';
import { money } from '../lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const STATUS_HINT: Record<string, string> = {
  draft: "Qoralama — katalogda ko'rinmaydi.",
  pending: 'Tekshiruvda — administrator ko`rib chiqmoqda.',
  active: 'Sotuvda — katalogda ko`rinadi.',
  rejected: 'Rad etilgan — tuzatib qayta yuboring.',
  archived: 'Arxivda — katalogda yo`q.',
};

/** Ombor faqat shu yerdan o'zgaradi: har variant alohida saqlanadi. */
function StockEditor({
  variant,
  busy,
  onSave,
}: {
  variant: StoreProductDetail['variants'][number];
  busy: boolean;
  onSave: (sizes: Array<{ size: string; stock: number }>) => void;
}): JSX.Element {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(variant.sizes.map((size) => [size.size, String(size.stock)])),
  );
  const [saved, setSaved] = useState(false);

  const changed = variant.sizes.some(
    (size) => Number(values[size.size] ?? size.stock) !== size.stock,
  );

  return (
    <div className="rounded-xl border border-border bg-surface2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="h-6 w-6 rounded-full border border-border"
            style={{ backgroundColor: variant.colorHex ?? '#1a1a1a' }}
          />
          <div>
            <p className="text-sm font-medium text-foreground">{variant.colorName || 'Rang'}</p>
            {/*
              ⚠️ 3D HOLATI OLIB TASHLANDI. Har variant yonida «3D tayyor /
              navbatda / yo'q» yozilardi — sotuvchi uni mahsulot
              ilovada ko'rinishining sharti deb tushunardi. Aslida
              kiyintirish mahsulot suratidan bo'ladi va variantning
              3D holati unga hech qanday ta'sir qilmaydi.
            */}
            {Number(variant.priceDelta) !== 0 ? (
              <p className="text-xs text-dim">Narx farqi {variant.priceDelta}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {variant.sizes.map((size) => (
          <label key={size.size} className="flex items-center gap-2 text-sm">
            <span className="w-10 text-muted-foreground">{size.size}</span>
            <Input
              type="number"
              min={size.reserved}
              max={9999}
              className="py-2 tabular-nums"
              value={values[size.size] ?? ''}
              onChange={(event) => {
                setSaved(false);
                setValues((prev) => ({ ...prev, [size.size]: event.target.value }));
              }}
            />
            {size.reserved > 0 ? (
              <span className="whitespace-nowrap text-xs text-warning">{size.reserved} band</span>
            ) : null}
          </label>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Button
          variant="outline"
          type="button"

          disabled={busy || !changed}
          onClick={() => {
            setSaved(true);
            onSave(
              variant.sizes.map((size) => ({
                size: size.size,
                stock: Math.max(0, Number(values[size.size] ?? size.stock)),
              })),
            );
          }}
        >
          Omborni saqlash
        </Button>
        {saved && !changed ? <span className="text-xs text-success">Saqlandi</span> : null}
        <span className="text-xs text-dim">Buyurtma qilingan miqdordan kam qilib bo'lmaydi.</span>
      </div>
    </div>
  );
}

export function EditProductPage(): JSX.Element {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();

  const product = useQuery({
    queryKey: ['store', 'product', id],
    queryFn: () => getStoreProduct(id),
    enabled: id.length > 0,
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [oldPrice, setOldPrice] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!product.data) return;
    setTitle(product.data.title);
    setDescription(product.data.description ?? '');
    setPrice(product.data.price);
    setOldPrice(product.data.oldPrice ?? '');
    setImages(product.data.images);
  }, [product.data]);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['store'] });
  };

  const save = useMutation({
    mutationFn: (status?: 'draft' | 'pending') =>
      updateProduct(id, {
        title: title.trim(),
        description: description.trim(),
        basePrice: price.trim(),
        images,
        ...(oldPrice.trim() ? { oldPrice: oldPrice.trim() } : {}),
        ...(status ? { status } : {}),
      }),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Saqlab bo'lmadi"),
  });

  const stock = useMutation({
    mutationFn: ({
      variantId,
      sizes,
    }: {
      variantId: string;
      sizes: Array<{ size: string; stock: number }>;
    }) => updateStock(variantId, sizes),
    onSuccess: invalidate,
    onError: (err) =>
      setError(err instanceof ApiClientError ? err.message : "Omborni saqlab bo'lmadi"),
  });

  if (product.isLoading) return <Spinner />;
  if (product.isError || !product.data) {
    return <ErrorState message="Mahsulot topilmadi" onRetry={() => void product.refetch()} />;
  }

  const data = product.data;
  // Nashrga yuborish uchun kamida 3 rasm kerak — server ham tekshiradi
  const canSubmit = images.length >= 3;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{data.title}</h1>
          <p className="mt-1 text-sm text-dim">{STATUS_HINT[data.status] ?? data.status}</p>
        </div>
        <Link to="/products" className="btn-ghost">
          Ro'yxatga qaytish
        </Link>
      </div>

      <section className="card space-y-4 p-5">
        <label className="block">
          <span className="label">Nomi</span>
          <Input
            className="mt-2"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <label className="block">
          <span className="label">Tavsif</span>
          <Textarea
            className="mt-2 min-h-24"
            value={description}
            maxLength={2000}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Narx ({data.currency})</span>
            <Input
              className="mt-2 tabular-nums"
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="label">Eski narx</span>
            <Input
              className="mt-2 tabular-nums"
              inputMode="decimal"
              value={oldPrice}
              placeholder="chegirma uchun"
              onChange={(event) => setOldPrice(event.target.value)}
            />
          </label>
        </div>

        <p className="text-xs text-dim">Joriy: {money(data.price, data.currency)}</p>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-sm font-semibold text-foreground">Rasmlar</h2>
        <ImageUploader images={images} onChange={setImages} />
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Ombor</h2>
          <p className="mt-1 text-xs text-dim">
            Har rang uchun alohida saqlanadi. Ombor darhol katalogda aks etadi.
          </p>
        </div>

        {data.variants.map((variant) => (
          <StockEditor
            key={variant.id}
            variant={variant}
            busy={stock.isPending}
            onSave={(sizes) => {
              setError(null);
              stock.mutate({ variantId: variant.id, sizes });
            }}
          />
        ))}
      </section>

      {error ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          type="button"

          disabled={save.isPending}
          onClick={() => {
            setError(null);
            save.mutate(undefined);
          }}
        >
          {save.isPending ? 'Saqlanmoqda…' : "O'zgarishlarni saqlash"}
        </Button>

        {data.status !== 'active' && data.status !== 'pending' ? (
          <Button
            type="button"

            disabled={save.isPending || !canSubmit}
            onClick={() => {
              setError(null);
              save.mutate('pending');
            }}
          >
            Tekshiruvga yuborish
          </Button>
        ) : null}

        {!canSubmit ? (
          <p className="w-full text-xs text-dim">
            Tekshiruvga yuborish uchun kamida 3 ta rasm kerak.
          </p>
        ) : null}
      </div>
    </div>
  );
}
