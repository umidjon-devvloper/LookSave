import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { getAssetQueue, updateAsset, type AssetJob, type AssetPublishBody } from '../api/admin';
import { EmptyState, ErrorState, Spinner } from '../components/Spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TABS = [
  { value: 'queued', label: 'Navbatda' },
  { value: 'processing', label: 'Ishlanmoqda' },
  { value: 'ready', label: 'Tayyor' },
  { value: 'failed', label: 'Xato' },
] as const;

type Tab = (typeof TABS)[number]['value'];

interface FormState {
  glbUrl: string;
  lod1: string;
  lod2: string;
  thumbnailUrl: string;
  polyCount: string;
  fileSizeBytes: string;
  hideBodyParts: string;
  hasMorphs: boolean;
  fpsHighEnd: string;
  fpsMidRange: string;
  fpsLowEnd: string;
  loadMs: string;
  ramMb: string;
  checklistPassed: boolean;
}

const EMPTY_FORM: FormState = {
  glbUrl: '',
  lod1: '',
  lod2: '',
  thumbnailUrl: '',
  polyCount: '',
  fileSizeBytes: '',
  hideBodyParts: '',
  hasMorphs: false,
  fpsHighEnd: '',
  fpsMidRange: '',
  fpsLowEnd: '',
  loadMs: '',
  ramMb: '',
  checklistPassed: false,
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}): JSX.Element {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <Input
        className="mt-2"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

/**
 * Nashr formasi. QA belgisi qo'yilmasa tugma ishlamaydi — bu intizom uchun:
 * bitta sifatsiz model butun ilova tajribasini buzadi (07-web-panels §5.3).
 * Server ham shu qoidani tekshiradi, forma faqat oldindan ogohlantiradi.
 */
function PublishForm({
  job,
  busy,
  onSubmit,
  onCancel,
}: {
  job: AssetJob;
  busy: boolean;
  onSubmit: (body: AssetPublishBody) => void;
  onCancel: () => void;
}): JSX.Element {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const set = (patch: Partial<FormState>): void => setForm((prev) => ({ ...prev, ...patch }));

  const ready =
    form.glbUrl.trim().length > 0 &&
    form.checklistPassed &&
    [form.fpsHighEnd, form.fpsMidRange, form.fpsLowEnd, form.loadMs, form.ramMb].every(
      (value) => Number(value) > 0,
    );

  function publish(): void {
    const lodUrls: Record<string, string> = { lod0: form.glbUrl.trim() };
    if (form.lod1.trim()) lodUrls['lod1'] = form.lod1.trim();
    if (form.lod2.trim()) lodUrls['lod2'] = form.lod2.trim();

    onSubmit({
      status: 'ready',
      glbUrl: form.glbUrl.trim(),
      lodUrls,
      hasMorphs: form.hasMorphs,
      hideBodyParts: form.hideBodyParts
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0),
      ...(form.thumbnailUrl.trim() ? { thumbnailUrl: form.thumbnailUrl.trim() } : {}),
      ...(Number(form.polyCount) > 0 ? { polyCount: Number(form.polyCount) } : {}),
      ...(Number(form.fileSizeBytes) > 0 ? { fileSizeBytes: Number(form.fileSizeBytes) } : {}),
      qaResult: {
        fpsHighEnd: Number(form.fpsHighEnd),
        fpsMidRange: Number(form.fpsMidRange),
        fpsLowEnd: Number(form.fpsLowEnd),
        loadMs: Number(form.loadMs),
        ramMb: Number(form.ramMb),
        checklistPassed: true,
      },
    });
  }

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-borderStrong bg-surface2 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="GLB (lod0)"
          value={form.glbUrl}
          onChange={(v) => set({ glbUrl: v })}
          placeholder="https://cdn.looksave.app/…"
        />
        <Field label="lod1" value={form.lod1} onChange={(v) => set({ lod1: v })} />
        <Field label="lod2" value={form.lod2} onChange={(v) => set({ lod2: v })} />
        <Field
          label="Thumbnail"
          value={form.thumbnailUrl}
          onChange={(v) => set({ thumbnailUrl: v })}
        />
        <Field
          label="Uchburchak"
          value={form.polyCount}
          onChange={(v) => set({ polyCount: v })}
          type="number"
        />
        <Field
          label="Hajm (bayt)"
          value={form.fileSizeBytes}
          onChange={(v) => set({ fileSizeBytes: v })}
          type="number"
        />
      </div>

      <Field
        label="Yashiriladigan tana qismlari"
        value={form.hideBodyParts}
        onChange={(v) => set({ hideBodyParts: v })}
        placeholder="body_foot_L, body_foot_R"
      />

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="accent-primary"
          checked={form.hasMorphs}
          onChange={(event) => set({ hasMorphs: event.target.checked })}
        />
        Blendshape'lar bor (tana o'lchami o'zgarganda kiyim ham o'zgaradi)
      </label>

      <div>
        <p className="label mb-2">QA natijasi</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="iPhone FPS"
            value={form.fpsHighEnd}
            onChange={(v) => set({ fpsHighEnd: v })}
            type="number"
          />
          <Field
            label="O'rta Android FPS"
            value={form.fpsMidRange}
            onChange={(v) => set({ fpsMidRange: v })}
            type="number"
          />
          <Field
            label="Eski Android FPS"
            value={form.fpsLowEnd}
            onChange={(v) => set({ fpsLowEnd: v })}
            type="number"
          />
          <Field
            label="Yuklanish (ms)"
            value={form.loadMs}
            onChange={(v) => set({ loadMs: v })}
            type="number"
          />
          <Field
            label="RAM (MB)"
            value={form.ramMb}
            onChange={(v) => set({ ramMb: v })}
            type="number"
          />
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 accent-primary"
          checked={form.checklistPassed}
          onChange={(event) => set({ checklistPassed: event.target.checked })}
        />
        <span>
          <span className="font-medium text-foreground">QA ro'yxati to'liq bajarildi</span>
          <span className="mt-0.5 block text-xs text-dim">
            Belgilanmasa nashr qilib bo'lmaydi. Bitta sifatsiz model butun ilova tajribasini buzadi.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" type="button" onClick={onCancel} disabled={busy}>
          Bekor
        </Button>
        <Button
          variant="outline"
          type="button"

          disabled={busy}
          onClick={() =>
            onSubmit({
              status: 'failed',
              hideBodyParts: [],
              hasMorphs: false,
              errorMessage: 'Fotolar yetarli emas',
            })
          }
        >
          Fotolar yetarli emas
        </Button>
        <Button type="button" disabled={busy || !ready} onClick={publish}>
          Nashr qilish
        </Button>
      </div>

      {!ready ? (
        <p className="text-xs text-dim">
          Nashr uchun GLB havolasi, beshta QA raqami va checklist belgisi kerak.
        </p>
      ) : null}

      <p className="text-xs text-dim">Variant: {job.variantId}</p>
    </div>
  );
}

export function AssetsPage(): JSX.Element {
  const [tab, setTab] = useState<Tab>('queued');
  const [editing, setEditing] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const jobs = useQuery({ queryKey: ['admin', '3d', tab], queryFn: () => getAssetQueue(tab) });

  const act = useMutation({
    mutationFn: ({ id, body }: { id: string; body: AssetPublishBody }) => updateAsset(id, body),
    onSuccess: () => {
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">3D navbat</h1>
        <p className="mt-1 text-sm text-dim">
          Do'kon so'ragan modellar. Manba fotolar yetarli bo'lsa ishga oling, tayyor bo'lganda QA
          natijasi bilan nashr qiling.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto border border-border bg-surface p-1">
          {TABS.map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              className="whitespace-nowrap rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {act.isError ? (
        <p className="text-sm text-danger">
          {act.error instanceof Error ? act.error.message : 'Saqlanmadi'}
        </p>
      ) : null}

      {jobs.isLoading ? <Spinner /> : null}
      {jobs.isError ? (
        <ErrorState message="Yuklab bo'lmadi" onRetry={() => void jobs.refetch()} />
      ) : null}
      {jobs.data?.length === 0 ? (
        <EmptyState title="Navbat bo'sh" hint="Do'kon 3D so'raganda shu yerda ko'rinadi." />
      ) : null}

      <div className="space-y-4">
        {jobs.data?.map((job) => (
          <article key={job.id} className="card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">
                  {job.product.title}
                  {job.colorName?.['uz'] ? (
                    <span className="text-muted-foreground"> · {job.colorName['uz']}</span>
                  ) : null}
                </h2>
                <p className="text-xs text-dim">
                  {job.storeName} · slot: {job.product.slot}
                  {job.requestedAt
                    ? ` · so'ralgan ${new Date(job.requestedAt).toLocaleDateString('uz-UZ')}`
                    : ''}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{job.status}</span>
            </div>

            {job.sourceImages.length > 0 ? (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {job.sourceImages.map((url) => (
                  <img
                    key={url}
                    src={url}
                    alt=""
                    className="h-24 w-24 shrink-0 rounded-lg border border-border object-cover"
                  />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-warning">Manba foto yo'q — modellash qiyin.</p>
            )}

            <p className="mt-2 text-xs text-dim">{job.sourceImages.length} ta manba foto</p>

            {job.errorMessage ? (
              <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
                {job.errorMessage}
              </p>
            ) : null}

            {job.status === 'ready' && job.qaResult ? (
              <p className="mt-3 text-xs text-success">
                {job.qaResult.fpsLowEnd} FPS (eski Android) · {job.qaResult.loadMs} ms ·{' '}
                {job.qaResult.ramMb} MB · {job.polyCount ?? '—'} uchburchak
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {job.status === 'queued' ? (
                <Button
                  variant="outline"
                  type="button"

                  disabled={act.isPending}
                  onClick={() =>
                    act.mutate({
                      id: job.id,
                      body: { status: 'processing', hideBodyParts: [], hasMorphs: false },
                    })
                  }
                >
                  Ishga olish
                </Button>
              ) : null}

              {job.status !== 'ready' ? (
                <Button
                  type="button"

                  onClick={() => setEditing(editing === job.id ? null : job.id)}
                >
                  {editing === job.id ? 'Yopish' : 'Model yuklash'}
                </Button>
              ) : null}
            </div>

            {editing === job.id ? (
              <PublishForm
                job={job}
                busy={act.isPending}
                onCancel={() => setEditing(null)}
                onSubmit={(body) => act.mutate({ id: job.id, body })}
              />
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
