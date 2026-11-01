import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  createBanner,
  deleteBanner,
  getBanners,
  updateBanner,
  uploadBannerImage,
  type BannerInput,
  type MarketplaceBanner,
} from '../api/admin';
import { EmptyState, ErrorState, Spinner } from '../components/Spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const EMPTY: BannerInput = {
  title: '',
  subtitle: '',
  imageUrl: '',
  targetUrl: '',
  audience: 'all',
  isActive: true,
  sortOrder: 0,
};

const AUDIENCE = {
  all: 'Barcha kolleksiyalar',
  men: 'Erkaklar',
  women: 'Ayollar',
  limited: 'Limited',
} as const;

function BannerForm({
  initial,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: BannerInput;
  busy: boolean;
  onSubmit: (input: BannerInput) => void;
  onCancel: () => void;
}): JSX.Element {
  const [form, setForm] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const set = <K extends keyof BannerInput>(key: K, value: BannerInput[K]): void =>
    setForm((current) => ({ ...current, [key]: value }));

  async function upload(file: File): Promise<void> {
    setUploading(true);
    setUploadError(null);
    try {
      set('imageUrl', await uploadBannerImage(file));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Rasm yuklanmadi');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ...form,
          title: form.title.trim(),
          subtitle: form.subtitle?.trim() || null,
          imageUrl: form.imageUrl.trim(),
          targetUrl: form.targetUrl?.trim() || null,
        });
      }}
    >
      <label className="grid gap-1">
        <span className="label">Sarlavha</span>
        <Input value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={100} required />
      </label>
      <label className="grid gap-1">
        <span className="label">Kolleksiya</span>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          value={form.audience}
          onChange={(e) => set('audience', e.target.value as BannerInput['audience'])}
        >
          {Object.entries(AUDIENCE).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="grid gap-1 sm:col-span-2">
        <span className="label">Qisqa matn</span>
        <Textarea value={form.subtitle ?? ''} onChange={(e) => set('subtitle', e.target.value)} maxLength={180} />
      </label>
      <div className="grid gap-2 sm:col-span-2">
        <span className="label">Banner rasmi</span>
        {form.imageUrl ? <img src={form.imageUrl} alt="Banner preview" className="aspect-[3/1] w-full rounded-md border border-border object-cover" /> : null}
        <div className="flex flex-wrap gap-2">
          <Input className="min-w-[220px] flex-1" type="url" value={form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} required placeholder="https://…" />
          <Button type="button" variant="outline" disabled={uploading} asChild>
            <label className="cursor-pointer"><ImagePlus className="h-4 w-4" /> {uploading ? 'Yuklanmoqda…' : 'Rasm tanlash'}
              <input type="file" className="hidden" accept="image/png,image/webp,image/jpeg" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void upload(file); }} />
            </label>
          </Button>
        </div>
        {uploadError ? <span className="text-sm text-danger">{uploadError}</span> : null}
      </div>
      <label className="grid gap-1">
        <span className="label">Bosilgandagi havola</span>
        <Input value={form.targetUrl ?? ''} onChange={(e) => set('targetUrl', e.target.value)} maxLength={500} placeholder="/product/... yoki https://..." />
      </label>
      <label className="grid gap-1">
        <span className="label">Tartib raqami</span>
        <Input type="number" min={0} max={9999} value={form.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
        <span className="text-sm text-foreground">Ilovada ko‘rsatilsin</span>
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={busy || uploading || !form.imageUrl || form.title.trim().length < 2}>Saqlash</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Bekor qilish</Button>
      </div>
    </form>
  );
}

export function BannersPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<MarketplaceBanner | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const banners = useQuery({ queryKey: ['admin', 'banners'], queryFn: getBanners });
  const done = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] });
    setEditing(null); setAdding(false); setError(null);
  };
  const fail = (err: Error): void => setError(err.message);
  const create = useMutation({ mutationFn: createBanner, onSuccess: done, onError: fail });
  const update = useMutation({ mutationFn: ({ id, input }: { id: string; input: BannerInput }) => updateBanner(id, input), onSuccess: done, onError: fail });
  const remove = useMutation({ mutationFn: deleteBanner, onSuccess: done, onError: fail });
  const busy = create.isPending || update.isPending || remove.isPending;

  if (banners.isLoading) return <Spinner />;
  if (banners.isError) return <ErrorState message="Bannerlar yuklanmadi" onRetry={() => void banners.refetch()} />;

  return (
    <section className="page-shell grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="page-title">Reklama bannerlari</h1><p className="page-copy">Market kolleksiyalarida har 6 ta mahsulotdan keyin chiqadi.</p></div>
        {!adding && !editing ? <Button type="button" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Banner qo‘shish</Button> : null}
      </header>
      {error ? <p className="card border-danger p-3 text-sm text-danger" role="alert">{error}</p> : null}
      {adding ? <div className="card p-6"><BannerForm initial={EMPTY} busy={busy} onSubmit={(input) => create.mutate(input)} onCancel={() => setAdding(false)} /></div> : null}
      {editing ? <div className="card p-6"><BannerForm initial={{ title: editing.title, subtitle: editing.subtitle, imageUrl: editing.imageUrl, targetUrl: editing.targetUrl, audience: editing.audience, isActive: editing.isActive, sortOrder: editing.sortOrder }} busy={busy} onSubmit={(input) => update.mutate({ id: editing.id, input })} onCancel={() => setEditing(null)} /></div> : null}
      {(banners.data ?? []).length === 0 && !adding ? <EmptyState title="Banner yo‘q" /> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {(banners.data ?? []).map((banner) => (
          <article key={banner.id} className="card overflow-hidden">
            <img src={banner.imageUrl} alt={banner.title} className="aspect-[3/1] w-full object-cover" />
            <div className="flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1"><h2 className="font-semibold text-foreground">{banner.title}</h2><p className="text-sm text-dim">{AUDIENCE[banner.audience]} · tartib {banner.sortOrder} · {banner.isActive ? 'Aktiv' : 'O‘chirilgan'}</p>{banner.subtitle ? <p className="mt-1 text-sm text-muted-foreground">{banner.subtitle}</p> : null}</div>
              <Button size="icon" variant="outline" type="button" aria-label="Tahrirlash" onClick={() => { setAdding(false); setEditing(banner); }}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" type="button" aria-label="O‘chirish" disabled={busy} onClick={() => { if (window.confirm('Bannerni o‘chirasizmi?')) remove.mutate(banner.id); }}><Trash2 className="h-4 w-4 text-danger" /></Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
