import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  claimTask,
  failTask,
  listTasks,
  releaseTask,
  submitResult,
  type Task,
  type TaskFilter,
} from '../api/tasks';
import { ApiClientError } from '../api/client';
import { AutoDress } from '../components/AutoDress';
import { DressBoard } from '../components/DressBoard';
import { EmptyState, Spinner } from '../components/Spinner';
import { useAuth } from '../hooks/useAuth';
import { useTaskAlerts } from '../hooks/useTaskAlerts';
import { timeAgo } from '../lib/format';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

/**
 * Operator navbati — panelning yagona ish sahifasi.
 *
 * Operatorning bitta ishi uchun qadamlar shu tartibda:
 *   1. Band qilish (boshqa operator ko'rsa ham ololmaydi)
 *   2. Yuz suratini yuklab olish va ko'rsatmani nusxalash
 *   3. Brauzerdagi AI da avatar yasash
 *   4. Natijani shu yerga tashlash → mijozga darhol boradi
 *
 * ⚠️ NAVBAT O'ZI YANGILANADI (har 5 soniyada). Operator sahifani ochiq
 * qoldiradi — yangi ish kelganini sarlavhadagi sondan ko'radi.
 */

const TABS: Array<{ value: TaskFilter; label: string }> = [
  { value: 'open', label: 'Navbat' },
  { value: 'done', label: 'Tayyor' },
  { value: 'failed', label: 'Bajarilmagan' },
];

const KIND_LABEL: Record<Task['kind'], string> = {
  avatar: 'Avatar',
  render: 'Kiyintirish',
};

/** 5 daqiqa — mijozga berilgan va'da. Undan oshsa ish qizaradi. */
const PROMISE_SECONDS = 5 * 60;

const MEASURE_LABEL: Record<string, string> = {
  height: 'Bo`y, sm',
  weight: 'Vazn, kg',
  chest: 'Ko`krak, sm',
  waist: 'Bel, sm',
  hip: 'Son, sm',
  shoeSize: 'Oyoq (EU)',
};

function errorText(err: unknown): string {
  return err instanceof ApiClientError ? err.message : 'Xatolik yuz berdi';
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * So'rov kelgandan beri o'tgan vaqt — mijozga berilgan 5 daqiqalik va'da
 * shu bilan o'lchanadi. Yopilgan ish uchun — yopilgan paytgacha.
 */
function waited(task: Task, now: number): number {
  const end = task.completedAt ? new Date(task.completedAt).getTime() : now;
  return Math.max(0, Math.round((end - new Date(task.createdAt).getTime()) / 1000));
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) return `${Math.floor(m / 60)} soat ${m % 60} daq`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function QueuePage(): JSX.Element {
  const { user, signOut } = useAuth();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<TaskFilter>('open');
  /*
   * ⚠️ XABAR SAHIFADA TURADI, TAFSILOTDA EMAS. Ish yopilgach u ro'yxatdan
   * chiqadi va tafsilot yopiladi — xabar o'sha komponentda bo'lsa,
   * operator «yuborildimi?» degan savol bilan qolardi.
   */
  const [flash, setFlash] = useState<string | null>(null);
  const now = useNow(1000);

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 6000);
    return () => window.clearTimeout(id);
  }, [flash]);

  const tasks = useQuery({
    queryKey: ['tasks', tab],
    queryFn: () => listTasks(tab),
    refetchInterval: tab === 'open' ? 5000 : false,
  });

  /*
   * ⚠️ SIGNAL UCHUN ALOHIDA, DOIMIY SO'ROV. Asosiy so'rov faqat «Navbat»
   * tabida yangilanadi — operator «Tayyor»da bo'lsa yangi ishni sezmasdi.
   * Bu so'rov tab qanday bo'lishidan qat'i nazar 5 soniyada yangilanadi
   * (fon oynada ham) va faqat ovoz/bildirishnoma hamda nishon uchun.
   */
  const openWatch = useQuery({
    queryKey: ['alerts', 'open'],
    queryFn: () => listTasks('open'),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });
  const pendingTasks = useMemo(
    () => (openWatch.data ?? []).filter((task) => task.status === 'pending'),
    [openWatch.data],
  );
  const alerts = useTaskAlerts(pendingTasks);

  const items = useMemo(() => tasks.data ?? [], [tasks.data]);
  const selectedId = params.get('task');
  const selected = items.find((task) => task.id === selectedId) ?? null;

  // Sarlavhada kutayotganlar soni — operator boshqa oynada bo'lsa ham ko'rsin
  const pending = pendingTasks.length;
  useEffect(() => {
    document.title = pending > 0 ? `(${pending}) Navbat — LookSave` : 'Navbat — LookSave';
  }, [pending]);

  // Telegramdan kelgan havola boshqa tabdagi ishga olib kelishi mumkin
  const selectedMissing = Boolean(selectedId) && tasks.isSuccess && !selected;

  function select(id: string | null): void {
    setParams(id ? { task: id } : {}, { replace: true });
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="flex items-center justify-between gap-4 border-b px-6 py-3">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-semibold uppercase tracking-wordmark text-brand">
            LookSave
          </span>
          <span className="text-sm text-dim">developer_ai</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={alerts.toggle}
            aria-pressed={alerts.enabled}
            title={
              alerts.enabled
                ? 'Ovozli xabar yoniq — yangi so`rovda signal beradi'
                : 'Ovozli xabarni yoqish (bir marta bosing)'
            }
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              alerts.enabled
                ? 'border-brand/40 bg-primary/10 text-brand'
                : 'border-border text-dim hover:text-foreground'
            }`}
          >
            <span aria-hidden>{alerts.enabled ? '🔔' : '🔕'}</span>
            {alerts.enabled ? 'Xabar yoniq' : 'Xabarni yoqish'}
          </button>
          {alerts.enabled && alerts.permission === 'denied' ? (
            <span className="text-xs text-warning" title="Brauzer bildirishnomasi bloklangan">
              faqat ovoz
            </span>
          ) : null}
          <span className="text-dim">{user?.fullName}</span>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            Chiqish
          </Button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
        {/* ── Ro'yxat ── */}
        <aside className="border-b md:border-b-0 md:border-r">
          <nav className="flex gap-1 border-b px-3 py-2" aria-label="Holat">
            {TABS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setTab(item.value)}
                aria-pressed={tab === item.value}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  tab === item.value
                    ? 'bg-surface2 font-semibold text-foreground'
                    : 'text-dim hover:text-foreground'
                }`}
              >
                {item.label}
                {item.value === 'open' && pending > 0 ? (
                  <span className="ml-2 rounded-full bg-warning/15 px-1.5 text-xs font-semibold text-warning">
                    {pending}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>

          {tasks.isLoading ? <Spinner /> : null}
          {tasks.isError ? (
            <p className="m-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
              {errorText(tasks.error)}
            </p>
          ) : null}

          {tasks.isSuccess && items.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={tab === 'open' ? 'Navbat bo`sh' : 'Hozircha yo`q'}
                hint={
                  tab === 'open'
                    ? 'Yangi so`rov kelsa shu yerda paydo bo`ladi va Telegramga xabar boradi.'
                    : undefined
                }
              />
            </div>
          ) : null}

          <ul className="divide-y">
            {items.map((task) => {
              const seconds = waited(task, now);
              const late = task.status === 'pending' && seconds > PROMISE_SECONDS;
              const mine = task.claimedBy === user?.id;

              return (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => select(task.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface2 ${
                      selected?.id === task.id ? 'bg-surface2' : ''
                    }`}
                  >
                    <Thumb
                      url={
                        task.status === 'done'
                          ? (task.resultUrl ?? task.previews.faceUrl)
                          : task.previews.faceUrl
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">
                        {KIND_LABEL[task.kind]}{' '}
                        <span className="font-normal text-dim">#{task.id.slice(0, 8)}</span>
                      </span>
                      <span className="block truncate text-xs text-dim">
                        {task.status === 'pending'
                          ? 'Hech kim olmagan'
                          : task.status === 'claimed'
                            ? mine
                              ? 'Siz bajaryapsiz'
                              : `${task.claimedByName ?? 'Operator'} bajaryapti`
                            : timeAgo(task.completedAt ?? task.createdAt)}
                      </span>
                    </span>
                    {tab === 'open' ? (
                      <span
                        className={`shrink-0 font-mono text-xs tabular-nums ${
                          late ? 'font-semibold text-danger' : 'text-dim'
                        }`}
                        title="Navbatda kutgan vaqt"
                      >
                        {clock(seconds)}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* ── Tafsilot ── */}
        <main className="min-w-0 space-y-4 p-6">
          {flash ? (
            <p role="status" className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
              {flash}
            </p>
          ) : null}
          {selected ? (
            <TaskDetail
              key={selected.id}
              task={selected}
              now={now}
              onClosed={(message) => {
                setFlash(message);
                select(null);
              }}
            />
          ) : selectedMissing ? (
            <EmptyState
              title="Bu ish bu ro`yxatda yo`q"
              hint="U allaqachon yopilgan bo`lishi mumkin — «Tayyor» yoki «Bajarilmagan» ni oching."
            />
          ) : (
            <EmptyState title="Ishni tanlang" hint="Chapdagi ro`yxatdan birini oching." />
          )}
        </main>
      </div>
    </div>
  );
}

function Thumb({ url }: { url: string | null | undefined }): JSX.Element {
  return url ? (
    <img src={url} alt="" className="h-11 w-11 shrink-0 rounded-md bg-surface2 object-cover" />
  ) : (
    <span className="h-11 w-11 shrink-0 rounded-md bg-surface2" />
  );
}

function TaskDetail({
  task,
  now,
  onClosed,
}: {
  task: Task;
  now: number;
  onClosed: (message: string) => void;
}): JSX.Element {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [failing, setFailing] = useState(false);
  const [reason, setReason] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const mine = task.status === 'claimed' && task.claimedBy === user?.id;
  const takenByOther = task.status === 'claimed' && !mine;
  const seconds = waited(task, now);

  const refresh = (): Promise<void> => queryClient.invalidateQueries({ queryKey: ['tasks'] });

  const onError = (err: unknown): void => {
    setNotice(errorText(err));
    void refresh();
  };

  const claim = useMutation({
    mutationFn: () => claimTask(task.id),
    onSuccess: () => {
      setNotice(null);
      void refresh();
    },
    onError,
  });

  const release = useMutation({
    mutationFn: () => releaseTask(task.id),
    onSuccess: () => void refresh(),
    onError,
  });

  const submit = useMutation({
    mutationFn: (picked: File) => submitResult(task.id, picked),
    onSuccess: async () => {
      setFile(null);
      await refresh();
      onClosed(`#${task.id.slice(0, 8)} tayyor — mijozga yuborildi`);
    },
    onError,
  });

  const fail = useMutation({
    mutationFn: () => failTask(task.id, reason.trim()),
    onSuccess: async () => {
      await refresh();
      onClosed(`#${task.id.slice(0, 8)} yopildi — mijozga sabab yuborildi`);
    },
    onError,
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

  function onDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    if (mine) pick(event.dataTransfer.files[0]);
  }

  async function copyPrompt(): Promise<void> {
    if (!task.payload.prompt) return;
    await navigator.clipboard.writeText(task.payload.prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  // ⚠️ jsonb kalit tartibini saqlamaydi — bo'y va vazn birinchi bo'lsin
  const source = task.payload.measurements ?? {};
  const measurements = Object.keys(MEASURE_LABEL)
    .filter((key) => source[key] !== undefined && source[key] !== null)
    .map((key) => [key, source[key]] as const);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label">{KIND_LABEL[task.kind]}</p>
          <h1 className="mt-1 text-xl font-bold text-foreground">#{task.id.slice(0, 8)}</h1>
          <p className="mt-1 text-sm text-dim">
            {timeAgo(task.createdAt)} kelgan ·{' '}
            <span
              className={
                task.status === 'pending' && seconds > PROMISE_SECONDS
                  ? 'font-semibold text-danger'
                  : ''
              }
            >
              {task.status === 'done' || task.status === 'failed'
                ? `${clock(seconds)} da yopilgan`
                : `${clock(seconds)} kutmoqda`}
            </span>
          </p>
        </div>

        <StatusPill task={task} mine={mine} />
      </div>

      {notice ? (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Manba */}
        <section className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="label">Yuz surati</h2>
            {task.previews.faceUrl ? (
              <a
                href={task.previews.faceUrl}
                target="_blank"
                rel="noreferrer"
                download
                className="text-sm font-medium text-brand hover:underline"
              >
                Yuklab olish
              </a>
            ) : null}
          </div>
          {task.previews.faceUrl ? (
            <img
              src={task.previews.faceUrl}
              alt="Mijozning yuz surati"
              className="aspect-[3/4] max-h-[460px] w-full rounded-md bg-surface2 object-cover"
            />
          ) : (
            <p className="text-sm text-dim">Surat yo`q</p>
          )}

          {measurements.length > 0 ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {task.payload.gender ? (
                <>
                  <dt className="text-dim">Jins</dt>
                  <dd className="text-right font-medium text-foreground">
                    {task.payload.gender === 'female' ? 'Ayol' : 'Erkak'}
                  </dd>
                </>
              ) : null}
              {measurements.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-dim">{MEASURE_LABEL[key]}</dt>
                  <dd className="text-right font-medium tabular-nums text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {/* Kiyintirish (render) ishi — gavda + KIYIM rasmi */}
          {task.kind === 'render' && (task.previews.bodyUrl || task.previews.garmentImageUrl) ? (
            <div className="grid grid-cols-2 gap-3">
              {task.previews.bodyUrl ? (
                <figure className="space-y-1">
                  <figcaption className="label text-xs">Gavda (avatar)</figcaption>
                  <img
                    src={task.previews.bodyUrl}
                    alt="Kiyintiriladigan gavda"
                    className="aspect-[3/4] w-full rounded-md bg-surface2 object-cover"
                  />
                </figure>
              ) : null}
              {/*
               * ⚠️ BUNDLE (komplekt) — payload.bundle bor bo'lsa, panel
               * bundleGarment1Url, bundleGarment2Url ... kalitlarini oladi va
               * HAMMA kiyimni ko'rsatadi. Aks holda eski single garmentImageUrl.
               */}
              {Object.keys(task.previews)
                .filter((k) => /^bundleGarment\d+Url$/.test(k))
                .sort().length > 0 ? (
                <div className="flex flex-col gap-2">
                  <span className="label text-xs">Komplekt kiyimlari</span>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(task.previews)
                      .filter((k) => /^bundleGarment\d+Url$/.test(k))
                      .sort()
                      .map((k) => (
                        <img
                          key={k}
                          src={task.previews[k]}
                          alt="Komplekt kiyim"
                          className="aspect-[3/4] w-full rounded-md bg-surface2 object-contain"
                        />
                      ))}
                  </div>
                </div>
              ) : task.previews.garmentImageUrl ? (
                <figure className="space-y-1">
                  <figcaption className="label text-xs">Kiyim</figcaption>
                  <img
                    src={task.previews.garmentImageUrl}
                    alt="Kiyiladigan kiyim"
                    className="aspect-[3/4] w-full rounded-md bg-surface2 object-contain"
                  />
                </figure>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* Natija */}
        <section className="card space-y-4 p-5">
          <h2 className="label">
            {task.status === 'done'
              ? 'Natija'
              : task.status === 'failed'
                ? 'Sabab — mijozga ko`rsatilgan'
                : 'Natijani yuklash'}
          </h2>

          {task.status === 'done' && task.resultUrl ? (
            <img
              src={task.resultUrl}
              alt="Tayyor avatar"
              className="aspect-[3/4] max-h-[460px] w-full rounded-md bg-surface2 object-cover"
            />
          ) : task.status === 'failed' ? (
            <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{task.error}</p>
          ) : (
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
              className={`flex aspect-[3/4] max-h-[460px] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-md border-2 border-dashed text-center ${
                mine ? 'border-borderStrong' : 'border-border opacity-60'
              }`}
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Yuklanadigan natija"
                  className="h-full w-full object-cover"
                />
              ) : (
                <>
                  <p className="px-6 text-sm text-dim">
                    {mine ? 'Tayyor suratni shu yerga tashlang' : 'Avval ishni band qiling'}
                  </p>
                  {mine ? (
                    <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                      Faylni tanlash
                    </Button>
                  ) : null}
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => pick(event.target.files?.[0])}
              />
            </div>
          )}

          {mine && file ? (
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={submit.isPending}
                onClick={() => submit.mutate(file)}
              >
                {submit.isPending ? 'Yuborilmoqda…' : 'Mijozga yuborish'}
              </Button>
              <Button variant="ghost" disabled={submit.isPending} onClick={() => setFile(null)}>
                Boshqasi
              </Button>
            </div>
          ) : null}
        </section>
      </div>

      <AutoDress taskId={task.id} />

      {task.kind === 'avatar' ? (
        <DressBoard taskId={task.id} avatarReady={task.status === 'done'} />
      ) : null}

      {task.payload.prompt ? (
        <section className="card space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="label">AI uchun ko`rsatma</h2>
            <Button variant="outline" size="sm" onClick={() => void copyPrompt()}>
              {copied ? 'Nusxalandi' : 'Nusxalash'}
            </Button>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {task.payload.prompt}
          </p>
        </section>
      ) : null}

      {/* ── Amallar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {task.status === 'pending' ? (
          <Button disabled={claim.isPending} onClick={() => claim.mutate()}>
            {claim.isPending ? 'Band qilinmoqda…' : 'Band qilaman'}
          </Button>
        ) : null}

        {mine ? (
          <>
            <Button variant="outline" disabled={release.isPending} onClick={() => release.mutate()}>
              Navbatga qaytarish
            </Button>
            <Button variant="ghost" onClick={() => setFailing((value) => !value)}>
              Bajara olmayman
            </Button>
          </>
        ) : null}

        {takenByOther ? (
          <p className="text-sm text-dim">
            Bu ishni {task.claimedByName ?? 'boshqa operator'} bajaryapti
          </p>
        ) : null}
      </div>

      {mine && failing ? (
        <section className="card space-y-3 p-5">
          <label className="block">
            <span className="label">Sabab — mijoz shuni ko`radi</span>
            <Textarea
              className="mt-2"
              rows={3}
              maxLength={300}
              value={reason}
              placeholder="Masalan: yuz surati xira, qaytadan skanerlang"
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <Button
            variant="destructive"
            disabled={reason.trim().length < 3 || fail.isPending}
            onClick={() => fail.mutate()}
          >
            Mijozga yuborish
          </Button>
        </section>
      ) : null}
    </div>
  );
}

function StatusPill({ task, mine }: { task: Task; mine: boolean }): JSX.Element {
  const map: Record<Task['status'], { text: string; cls: string }> = {
    pending: { text: 'Kutmoqda', cls: 'bg-warning/15 text-warning' },
    claimed: {
      text: mine ? 'Sizda' : `${task.claimedByName ?? 'Operator'}da`,
      cls: 'bg-primary/15 text-brand',
    },
    done: { text: 'Tayyor', cls: 'bg-success/15 text-success' },
    failed: { text: 'Bajarilmagan', cls: 'bg-danger/15 text-danger' },
    expired: { text: 'Avtomatga o`tgan', cls: 'bg-surface2 text-dim' },
  };
  const pill = map[task.status];
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${pill.cls}`}>{pill.text}</span>
  );
}
