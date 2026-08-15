import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiClientError } from '../api/client';
import {
  createProduct,
  getBrands,
  getCategories,
  type Category,
  type CreateProductBody,
  type VariantInput,
} from '../api/products';
import { Spinner } from '../components/Spinner';
import { ImageUploader } from '../components/products/ImageUploader';
import { VariantEditor, emptyVariant } from '../components/products/VariantEditor';

/** Faqat `slot` bor kategoriyalarga mahsulot qo'shish mumkin — 3D avatar uchun kerak. */
function flatten(categories: Category[], depth = 0): Array<{ id: string; label: string }> {
  return categories.flatMap((category) => [
    ...(category.slot ? [{ id: category.id, label: `${'— '.repeat(depth)}${category.name}` }] : []),
    ...flatten(category.children, depth + 1),
  ]);
}

export function NewProductPage(): JSX.Element {
  const navigate = useNavigate();

  const categories = useQuery({ queryKey: ['categories'], queryFn: getCategories });
  const brands = useQuery({ queryKey: ['brands'], queryFn: getBrands });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'unisex'>('unisex');
  const [basePrice, setBasePrice] = useState('');
  const [oldPrice, setOldPrice] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [tags, setTags] = useState('');
  const [isLimited, setIsLimited] = useState(false);
  const [request3d, setRequest3d] = useState(false);
  const [variants, setVariants] = useState<VariantInput[]>([emptyVariant()]);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => flatten(categories.data ?? []), [categories.data]);

  const save = useMutation({
    mutationFn: (status: 'draft' | 'pending') => {
      const body: CreateProductBody = {
        title: title.trim(),
        categoryId,
        gender,
        basePrice,
        images,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0),
        isLimited,
        status,
        variants,
        request3d,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(brandId ? { brandId } : {}),
        ...(oldPrice.trim() ? { oldPrice } : {}),
      };
      return createProduct(body);
    },
    onSuccess: () => navigate('/products'),
    onError: (err) => {
      setError(
        err instanceof ApiClientError
          ? `${err.message}${describeFields(err.details)}`
          : "Saqlab bo'lmadi",
      );
    },
  });

  /** Server maydon xatolarini qaytaradi — ularni o'qiladigan matnga aylantiramiz. */
  function describeFields(details: unknown): string {
    if (typeof details !== 'object' || details === null || !('fields' in details)) return '';
    const fields = (details as { fields: Array<{ field: string; message: string }> }).fields;
    return `: ${fields.map((item) => `${item.field} — ${item.message}`).join('; ')}`;
  }

  function submit(event: FormEvent, status: 'draft' | 'pending'): void {
    event.preventDefault();
    setError(null);
    save.mutate(status);
  }

  if (categories.isLoading) return <Spinner />;

  const canPublish = images.length >= 3;

  return (
    <form className="max-w-3xl space-y-6" onSubmit={(event) => submit(event, 'pending')}>
      <div>
        <h1 className="text-xl font-semibold text-white">Yangi mahsulot</h1>
        <p className="mt-1 text-sm text-dim">
          Qoralama sifatida saqlab, keyinroq to'ldirishingiz mumkin. Tekshiruvga yuborilganda
          administrator ko'rib chiqadi va katalogda paydo bo'ladi.
        </p>
      </div>

      <section className="card space-y-4 p-5">
        <label className="block">
          <span className="label">Nomi</span>
          <input
            className="field mt-2"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Nike Air Max 90"
            required
            minLength={2}
            maxLength={200}
          />
        </label>

        <label className="block">
          <span className="label">Tavsif</span>
          <textarea
            className="field mt-2 min-h-24"
            value={description}
            maxLength={2000}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Material, o'ziga xosligi, parvarish"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Kategoriya</span>
            <select
              className="field mt-2"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              required
            >
              <option value="">Tanlang</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="label">Brend</span>
            <select
              className="field mt-2"
              value={brandId}
              onChange={(event) => setBrandId(event.target.value)}
            >
              <option value="">Ko'rsatilmagan</option>
              {(brands.data ?? []).map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="label">Kim uchun</span>
            <select
              className="field mt-2"
              value={gender}
              onChange={(event) => setGender(event.target.value as 'male' | 'female' | 'unisex')}
            >
              <option value="unisex">Hammaga</option>
              <option value="male">Erkaklar</option>
              <option value="female">Ayollar</option>
            </select>
          </label>

          <label className="block">
            <span className="label">Teglar</span>
            <input
              className="field mt-2"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="yozgi, sport, yangi"
            />
          </label>

          <label className="block">
            <span className="label">Narx</span>
            <input
              className="field mt-2 tabular-nums"
              inputMode="decimal"
              value={basePrice}
              onChange={(event) => setBasePrice(event.target.value)}
              placeholder="1250000.00"
              required
            />
          </label>

          <label className="block">
            <span className="label">Eski narx (chegirma uchun)</span>
            <input
              className="field mt-2 tabular-nums"
              inputMode="decimal"
              value={oldPrice}
              onChange={(event) => setOldPrice(event.target.value)}
              placeholder="1500000.00"
            />
          </label>
        </div>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="accent-primary"
            checked={isLimited}
            onChange={(event) => setIsLimited(event.target.checked)}
          />
          Cheklangan seriya
        </label>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-sm font-semibold text-white">Rasmlar</h2>
        <ImageUploader images={images} onChange={setImages} />
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold text-white">Ranglar va o'lchamlar</h2>
          <p className="mt-1 text-xs text-dim">
            Har rang alohida variant. Ombor miqdori xaridor buyurtma berganda kamayadi.
          </p>
        </div>
        <VariantEditor variants={variants} onChange={setVariants} />
      </section>

      <section className="card p-5">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 accent-primary"
            checked={request3d}
            onChange={(event) => setRequest3d(event.target.checked)}
          />
          <span>
            <span className="font-medium text-white">3D model so'rash</span>
            <span className="mt-0.5 block text-xs text-dim">
              Mahsulot navbatga qo'yiladi. 3D bilan mahsulotlar ilovada kiyib ko'rish mumkin bo'ladi
              va ko'proq buyurtma oladi.
            </span>
          </span>
        </label>
      </section>

      {error ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="btn-ghost"
          disabled={save.isPending}
          onClick={(event) => submit(event, 'draft')}
        >
          Qoralama sifatida saqlash
        </button>
        <button type="submit" className="btn-primary" disabled={save.isPending || !canPublish}>
          {save.isPending ? 'Saqlanmoqda…' : 'Tekshiruvga yuborish'}
        </button>
        {!canPublish ? (
          <p className="w-full text-xs text-dim">
            Tekshiruvga yuborish uchun kamida 3 ta rasm kerak.
          </p>
        ) : null}
      </div>
    </form>
  );
}
