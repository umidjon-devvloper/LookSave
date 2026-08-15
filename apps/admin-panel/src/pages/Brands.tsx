import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  createBrand,
  deleteBrand,
  getBrands,
  updateBrand,
  type Brand,
  type BrandInput,
} from '../api/admin';
import { EmptyState, ErrorState, Spinner } from '../components/Spinner';

const EMPTY: BrandInput = {
  name: '',
  slug: '',
  logoUrl: '',
  description: '',
  isPartner: false,
  sortOrder: 0,
};

/**
 * Brend formasi — yaratish va tahrirlash uchun bitta komponent.
 * Bo'sh matn maydonlari serverga `null` bo'lib ketadi, `''` emas: bazada
 * bo'sh satr bilan NULL aralashib qolmasligi uchun.
 */
function BrandForm({
  initial,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: BrandInput;
  busy: boolean;
  submitLabel: string;
  onSubmit: (input: BrandInput) => void;
  onCancel?: () => void;
}): JSX.Element {
  const [form, setForm] = useState<BrandInput>(initial);

  const set = <K extends keyof BrandInput>(key: K, value: BrandInput[K]): void =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ...form,
          name: form.name.trim(),
          slug: form.slug?.trim() ? form.slug.trim() : undefined,
          logoUrl: form.logoUrl?.trim() ? form.logoUrl.trim() : null,
          description: form.description?.trim() ? form.description.trim() : null,
        });
      }}
    >
      <label className="grid gap-1">
        <span className="label">Nomi</span>
        <input
          className="field"
          value={form.name}
          onChange={(event) => set('name', event.target.value)}
          placeholder="Nike"
          required
          minLength={2}
          maxLength={64}
        />
      </label>

      <label className="grid gap-1">
        <span className="label">Slug</span>
        <input
          className="field"
          value={form.slug ?? ''}
          onChange={(event) => set('slug', event.target.value)}
          placeholder="nomdan avtomatik yasaladi"
          pattern="[a-z0-9-]+"
          maxLength={64}
        />
      </label>

      <label className="grid gap-1 sm:col-span-2">
        <span className="label">Logotip havolasi</span>
        <input
          className="field"
          value={form.logoUrl ?? ''}
          onChange={(event) => set('logoUrl', event.target.value)}
          placeholder="https://…/nike.webp"
          type="url"
        />
      </label>

      <label className="grid gap-1 sm:col-span-2">
        <span className="label">Tavsif</span>
        <textarea
          className="field min-h-[64px]"
          value={form.description ?? ''}
          onChange={(event) => set('description', event.target.value)}
          maxLength={500}
        />
      </label>

      <label className="grid gap-1">
        <span className="label">Tartib raqami</span>
        <input
          className="field"
          type="number"
          min={0}
          max={9999}
          value={form.sortOrder}
          onChange={(event) => set('sortOrder', Number(event.target.value))}
        />
      </label>

      <label className="flex items-center gap-2 self-end pb-2">
        <input
          type="checkbox"
          checked={form.isPartner}
          onChange={(event) => set('isPartner', event.target.checked)}
        />
        <span className="text-sm text-white">Hamkor brend (shartnoma bor)</span>
      </label>

      <div className="flex gap-2 sm:col-span-2">
        <button
          className="btn-primary"
          type="submit"
          disabled={busy || form.name.trim().length < 2}
        >
          {busy ? 'Saqlanmoqda…' : submitLabel}
        </button>
        {onCancel ? (
          <button className="btn-ghost" type="button" onClick={onCancel}>
            Bekor qilish
          </button>
        ) : null}
      </div>
    </form>
  );
}

function BrandRow({
  brand,
  busy,
  onEdit,
  onDelete,
}: {
  brand: Brand;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}): JSX.Element {
  return (
    <article className="card flex flex-wrap items-center gap-4 p-4">
      {brand.logoUrl ? (
        <img
          src={brand.logoUrl}
          alt={brand.name}
          className="h-12 w-12 rounded-xl border border-border object-contain"
        />
      ) : (
        <div className="grid h-12 w-12 place-items-center rounded-xl border border-dashed border-borderStrong text-xs text-dim">
          —
        </div>
      )}

      <div className="min-w-[140px] flex-1">
        <h2 className="font-semibold text-white">
          {brand.name}
          {brand.isPartner ? (
            <span className="ml-2 rounded-full border border-accent px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">
              Hamkor
            </span>
          ) : null}
        </h2>
        <p className="text-xs text-dim">
          /{brand.slug} · tartib {brand.sortOrder} · {brand.productCount} mahsulot
        </p>
      </div>

      <div className="flex gap-2">
        <button className="btn-ghost" type="button" onClick={onEdit} disabled={busy}>
          Tahrirlash
        </button>
        <button
          className="btn-ghost text-danger"
          type="button"
          onClick={onDelete}
          disabled={busy || brand.productCount > 0}
          // Mahsuloti bor brendni server ham o'chirmaydi — tugma oldindan o'chiriladi
          title={
            brand.productCount > 0
              ? 'Mahsuloti bor brendni o`chirib bo`lmaydi'
              : "Brendni o'chirish"
          }
        >
          O&apos;chirish
        </button>
      </div>
    </article>
  );
}

export function BrandsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Brand | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const brands = useQuery({ queryKey: ['admin', 'brands'], queryFn: getBrands });

  const done = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'brands'] });
    setEditing(null);
    setAdding(false);
    setError(null);
  };
  const fail = (err: Error): void => setError(err.message);

  const create = useMutation({ mutationFn: createBrand, onSuccess: done, onError: fail });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<BrandInput> }) =>
      updateBrand(id, input),
    onSuccess: done,
    onError: fail,
  });
  const remove = useMutation({ mutationFn: deleteBrand, onSuccess: done, onError: fail });

  const busy = create.isPending || update.isPending || remove.isPending;

  if (brands.isLoading) return <Spinner />;
  if (brands.isError) {
    return <ErrorState message="Brendlar yuklanmadi" onRetry={() => void brands.refetch()} />;
  }

  const items = brands.data ?? [];

  return (
    <section className="grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Brendlar</h1>
          <p className="text-sm text-dim">
            Ilovaning bosh sahifasidagi «TOP BRANDS» qatori shu ro&apos;yxatdan quriladi. Tartib
            raqami kichik bo&apos;lgani birinchi chiqadi.
          </p>
        </div>
        {!adding && !editing ? (
          <button className="btn-primary" type="button" onClick={() => setAdding(true)}>
            Brend qo&apos;shish
          </button>
        ) : null}
      </header>

      {error ? (
        <p className="card border-danger p-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {adding ? (
        <div className="card p-4">
          <h2 className="mb-3 font-semibold text-white">Yangi brend</h2>
          <BrandForm
            initial={EMPTY}
            busy={busy}
            submitLabel="Qo'shish"
            onSubmit={(input) => create.mutate(input)}
            onCancel={() => {
              setAdding(false);
              setError(null);
            }}
          />
        </div>
      ) : null}

      {editing ? (
        <div className="card p-4">
          <h2 className="mb-3 font-semibold text-white">{editing.name} — tahrirlash</h2>
          <BrandForm
            initial={{
              name: editing.name,
              slug: editing.slug,
              logoUrl: editing.logoUrl ?? '',
              description: editing.description ?? '',
              isPartner: editing.isPartner,
              sortOrder: editing.sortOrder,
            }}
            busy={busy}
            submitLabel="Saqlash"
            onSubmit={(input) => update.mutate({ id: editing.id, input })}
            onCancel={() => {
              setEditing(null);
              setError(null);
            }}
          />
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title="Brend yo'q"
          hint="Birinchi brendni qo'shing — u ilovada darhol ko'rinadi."
        />
      ) : (
        <div className="grid gap-3">
          {items.map((brand) => (
            <BrandRow
              key={brand.id}
              brand={brand}
              busy={busy}
              onEdit={() => {
                setEditing(brand);
                setAdding(false);
                setError(null);
              }}
              onDelete={() => remove.mutate(brand.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
