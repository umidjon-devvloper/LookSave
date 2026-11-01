import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ApiClientError } from '../api/client';
import { dressBoard, submitDress, type DressGarment } from '../api/tasks';
import { Button } from '@/components/ui/button';
import { EmptyState, Spinner } from './Spinner';

/**
 * Kiyintirish taxtasi — avatar tayyor bo'lgach ochiladi.
 *
 * Operator do'konning har bir kiyimini avatarga BITTALAB kiydiradi
 * (brauzerdagi AI'da) va natijani shu yerga tashlaydi. Har yuklash mijozning
 * renderiga tushadi — mijoz ilovada o'zini o'sha kiyimda tayyor ko'radi.
 *
 * ⚠️ NEGA ALOHIDA NAVBAT EMAS. Bir avatarga o'nlab kiyim kiydiriladi — har
 * biri alohida navbat yozuvi bo'lsa panjaraga sig'masdi. Hammasi shu bitta
 * avatar ishining ichida, gridda turadi.
 */

const SLOT_LABEL: Record<string, string> = {
  top: 'Ust',
  outer: 'Ustki kiyim',
  bottom: 'Pastki',
  feet: 'Oyoq kiyim',
};

function errorText(err: unknown): string {
  return err instanceof ApiClientError ? err.message : 'Xatolik yuz berdi';
}

export function DressBoard({
  taskId,
  avatarReady,
}: {
  taskId: string;
  /** Avatar yasalib yuklandimi. Yo'q bo'lsa grid ko'rinadi, lekin ogohlantirish chiqadi. */
  avatarReady: boolean;
}): JSX.Element {
  const board = useQuery({
    queryKey: ['dress', taskId],
    queryFn: () => dressBoard(taskId),
  });

  if (board.isLoading) return <Spinner label="Kiyimlar yuklanmoqda" />;
  if (board.isError) {
    return (
      <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
        {errorText(board.error)}
      </p>
    );
  }

  const data = board.data;
  if (!data || data.garments.length === 0) {
    return (
      <EmptyState
        title="Kiydiriladigan kiyim yo`q"
        hint="Do`konda AI'ga yaroqli va omborda bor kiyim topilmadi."
      />
    );
  }

  const done = data.garments.filter((g) => g.done).length;

  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="label">Avatarni kiyintirish</h2>
          <p className="mt-1 text-sm text-dim">
            Har kiyimni avatarga kiydiring va natijani tashlang — mijozga darhol boradi.
          </p>
        </div>
        <span className="rounded-full bg-surface2 px-3 py-1 text-xs font-semibold tabular-nums text-dim">
          {done}/{data.garments.length} tayyor
        </span>
      </div>

      {!avatarReady ? (
        <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
          Avval yuqorida avatarni yasab yuklang — keyin shu kiyimlarni bittalab kiydirasiz.
        </p>
      ) : null}

      {data.avatarImage ? (
        <div className="flex items-center gap-3 rounded-md bg-surface2/60 p-3">
          <img
            src={data.avatarImage}
            alt="Kiydiriladigan avatar"
            className="h-20 w-16 shrink-0 rounded-md bg-surface2 object-cover"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Avatar</p>
            <a
              href={data.avatarImage}
              target="_blank"
              rel="noreferrer"
              download
              className="text-sm font-medium text-brand hover:underline"
            >
              Yuklab olish
            </a>
            <p className="mt-1 text-xs text-dim">Har kiyim uchun shu gavdadan foydalaning.</p>
          </div>
        </div>
      ) : null}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {data.garments.map((garment) => (
          <GarmentCard key={garment.variantId} taskId={taskId} garment={garment} />
        ))}
      </ul>
    </section>
  );
}

function GarmentCard({ taskId, garment }: { taskId: string; garment: DressGarment }): JSX.Element {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: (picked: File) => submitDress(taskId, garment.variantId, picked),
    onSuccess: async () => {
      setFile(null);
      await queryClient.invalidateQueries({ queryKey: ['dress', taskId] });
    },
    onError: (err) => setNotice(errorText(err)),
  });

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  function pick(picked: File | undefined): void {
    if (!picked) return;
    if (!picked.type.startsWith('image/')) {
      setNotice('Bu surat emas');
      return;
    }
    setNotice(null);
    setFile(picked);
  }

  const shown = preview ?? garment.garmentImage;

  return (
    <li className="flex flex-col gap-2 rounded-md border p-2">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded bg-surface2">
        {shown ? (
          <img
            src={shown}
            alt={garment.title}
            className={preview ? 'h-full w-full object-cover' : 'h-full w-full object-contain'}
          />
        ) : null}
        {garment.done ? (
          <span className="absolute right-1 top-1 rounded-full bg-success px-2 py-0.5 text-[10px] font-semibold text-white">
            Kiydirildi
          </span>
        ) : null}
      </div>

      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-foreground" title={garment.title}>
          {garment.title}
        </p>
        <p className="text-[11px] text-dim">{SLOT_LABEL[garment.slot] ?? garment.slot}</p>
      </div>

      {notice ? <p className="text-[11px] text-danger">{notice}</p> : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => pick(event.target.files?.[0])}
      />

      {file ? (
        <div className="flex gap-1">
          <Button
            size="sm"
            className="h-8 flex-1 text-xs"
            disabled={submit.isPending}
            onClick={() => submit.mutate(file)}
          >
            {submit.isPending ? 'Yuklanmoqda…' : 'Yuborish'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
            disabled={submit.isPending}
            onClick={() => setFile(null)}
          >
            ✕
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant={garment.done ? 'ghost' : 'outline'}
          className="h-8 text-xs"
          onClick={() => inputRef.current?.click()}
        >
          {garment.done ? 'Qayta kiydirish' : 'Natijani tashlang'}
        </Button>
      )}
    </li>
  );
}
