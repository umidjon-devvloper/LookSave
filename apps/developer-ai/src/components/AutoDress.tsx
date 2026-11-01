import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  available,
  diagnose,
  setAuto,
  start,
  status as readStatus,
  stop,
  type AdapterId,
  type RunStatus,
} from '../lib/extension';

/**
 * Avtomatik operator — brauzer kengaytmasini panel ichidan boshqaradi.
 *
 * Ikki rejim bor va ular bir-birining o'rnini bosmaydi:
 *
 *   «Shu ishni boshlash» — faqat ochiq turgan ishni bajaradi va to'xtaydi.
 *   «Avtomatik»          — navbatni O'ZI oladi: ish tushishi bilan hech kim
 *                          bosmasdan boshlaydi va ketma-ket davom etadi.
 *
 * Kiyintirishning o'zi kengaytmada bajariladi — bu sahifa yopilsa ham
 * davom etadi.
 *
 * ⚠️ KENGAYTMASIZ PANEL AVVALGIDEK ISHLAYDI. Blok shunchaki eslatmaga
 * aylanadi va operator ishni qo'lda bajaradi.
 */

const ADAPTER_KEY = 'looksave.developer-ai.adapter';

const ADAPTER_LABEL: Record<AdapterId, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
};

function storedAdapter(): AdapterId {
  return localStorage.getItem(ADAPTER_KEY) === 'gemini' ? 'gemini' : 'chatgpt';
}

export function AutoDress({ taskId }: { taskId: string }): JSX.Element {
  const queryClient = useQueryClient();
  const [installed] = useState(available);
  const [adapter, setAdapter] = useState<AdapterId>(storedAdapter);
  const [state, setState] = useState<{ status: RunStatus; authed: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /*
   * ⚠️ TAYYOR BO'LGANLAR SONI KUZATILADI. Kengaytma natijani to'g'ridan
   * to'g'ri serverga yozadi — panel bundan bexabar qoladi va «Kiydirildi»
   * belgisi faqat sahifa yangilangandan keyin chiqardi.
   */
  const finishedRef = useRef(-1);

  useEffect(() => {
    if (!installed) return undefined;

    let alive = true;

    async function poll(): Promise<void> {
      try {
        const next = await readStatus();
        if (!alive) return;

        setState(next);
        setNotice(null);

        if (next.status.finished !== finishedRef.current) {
          finishedRef.current = next.status.finished;
          void queryClient.invalidateQueries({ queryKey: ['dress', taskId] });
          void queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }
      } catch (error) {
        if (alive) setNotice(error instanceof Error ? error.message : 'Kengaytma javob bermadi');
      }
    }

    void poll();
    const timer = window.setInterval(() => void poll(), 2_000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [installed, queryClient, taskId]);

  if (!installed) {
    return (
      <p className="rounded-md bg-surface2/60 px-3 py-2 text-xs text-dim">
        Avtomatik bajarish uchun brauzer kengaytmasi kerak (`apps/browser-extension` — README ga
        qarang).
      </p>
    );
  }

  const run = state?.status;
  const running = run?.state === 'running';
  const auto = run?.auto === true;

  function pickAdapter(picked: AdapterId): void {
    setAdapter(picked);
    localStorage.setItem(ADAPTER_KEY, picked);
  }

  function begin(): void {
    setNotice(null);
    void start(taskId, adapter).catch((error: unknown) =>
      setNotice(error instanceof Error ? error.message : 'Boshlanmadi'),
    );
  }

  function check(): void {
    setNotice(null);
    void diagnose(adapter).catch((error: unknown) =>
      setNotice(error instanceof Error ? error.message : 'Tekshirilmadi'),
    );
  }

  function toggleAuto(enabled: boolean): void {
    setNotice(null);
    void setAuto(enabled, adapter).catch((error: unknown) =>
      setNotice(error instanceof Error ? error.message : 'Rejim yoqilmadi'),
    );
  }

  return (
    <section className="card space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="label">Avtomatik bajarish</h2>
          <p className="mt-1 text-sm text-dim">
            {running
              ? `${run.finished}/${run.total}${run.failed > 0 ? ` · ${run.failed} xato` : ''}${
                  run.current ? ` · ${run.current.title}` : ''
                }`
              : auto
                ? 'Navbat kutilmoqda — ish tushishi bilan o`zi boshlaydi.'
                : 'Kengaytma ishni AI`da bajarib, natijani mijozga darhol yuboradi.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={adapter}
            disabled={running}
            onChange={(event) => pickAdapter(event.target.value as AdapterId)}
            className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground disabled:opacity-50"
            aria-label="AI sayti"
          >
            {(Object.keys(ADAPTER_LABEL) as AdapterId[]).map((id) => (
              <option key={id} value={id}>
                {ADAPTER_LABEL[id]}
              </option>
            ))}
          </select>

          {running ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => void stop().catch(() => undefined)}
            >
              To`xtatish
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={check}
                title="Navbatga tegmaydi — faqat AI sahifasi ishlayaptimi, shuni tekshiradi"
              >
                Sahifani tekshirish
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={!state?.authed || auto}
                onClick={begin}
              >
                Shu ishni boshlash
              </Button>
            </>
          )}
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={auto}
          disabled={!state?.authed}
          onChange={(event) => toggleAuto(event.target.checked)}
          className="mt-1"
        />
        <span>
          Avtomatik rejim
          <span className="block text-xs text-dim">
            Navbatni o`zi oladi va ketma-ket bajaradi — hech kim bosmasa ham.
            {run && run.queued > 0 ? ` Hozir navbatda ${run.queued} ta ish.` : ''}
          </span>
        </span>
      </label>

      {state && !state.authed ? (
        <p className="text-xs text-warning">
          Kengaytmada kirilmagan — brauzer paneldagi kengaytma belgisini bosib kiring.
        </p>
      ) : null}

      {notice ? <p className="text-xs text-danger">{notice}</p> : null}

      {run && run.log.length > 0 ? (
        <ul className="max-h-32 space-y-1 overflow-y-auto rounded-md bg-surface2/50 p-2 text-[11px] text-dim">
          {run.log.slice(0, 12).map((line, index) => (
            <li key={`${line}-${index}`} className="truncate" title={line}>
              {line}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
