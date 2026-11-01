/**
 * Brauzer kengaytmasi bilan aloqa (`apps/browser-extension`).
 *
 * Panel kengaytmaga «shu ishni avtomatik kiydir» deb aytadi va holatni
 * so'rab turadi. Kiyintirishning o'zi kengaytmada bajariladi — panel
 * yopilsa ham davom etadi.
 *
 * ⚠️ `window.postMessage` ORQALI, TO'G'RIDAN-TO'G'RI EMAS. Sahifa
 * kengaytma bilan faqat uning ID'sini bilsa gaplasha oladi, ID esa
 * `Load unpacked` da har kompyuterda boshqacha. Kengaytmaning content
 * script'i shu sahifaga ulanib, xabarlarni uzatadi — ID kerak emas.
 *
 * ⚠️ KENGAYTMA YO'Q BO'LSA HECH NARSA SINMAYDI. `available()` `false`
 * qaytaradi va panel avvalgidek, qo'lda ishlaydi.
 */

export type RunState = 'idle' | 'running' | 'paused' | 'stopped';

export interface RunStatus {
  state: RunState;
  /** Avtomatik rejim — kengaytma navbatni o'zi oladi */
  auto: boolean;
  taskId: string | null;
  current: { title: string } | null;
  /** Navbatda qolgan ochiq ishlar */
  queued: number;
  total: number;
  finished: number;
  failed: number;
  log: string[];
}

export type AdapterId = 'chatgpt' | 'gemini';

type Request =
  | { type: 'STATUS' }
  | { type: 'START'; taskId: string; adapter: AdapterId }
  | { type: 'SET_AUTO'; enabled: boolean; adapter: AdapterId }
  | { type: 'DIAGNOSE'; adapter: AdapterId }
  | { type: 'STOP' };

/** Kengaytma o'rnatilganmi — uning ko'prigi `<html>` ga belgi qo'yadi. */
export function available(): boolean {
  return document.documentElement.dataset['looksaveExtension'] === '1';
}

/**
 * ⚠️ JAVOBSIZ QOLMASLIGI UCHUN TAYMAUT. Kengaytma o'rnatilgan, lekin
 * uning worker'i qulab tushgan bo'lishi mumkin — u holda javob umuman
 * kelmaydi va tugma abadiy «yuklanmoqda» bo'lib qolardi.
 */
const TIMEOUT_MS = 8_000;

let counter = 0;

function send<T>(request: Request, timeoutMs = TIMEOUT_MS): Promise<T> {
  if (!available()) {
    return Promise.reject(new Error('Kengaytma o`rnatilmagan'));
  }

  const id = `looksave-${(counter += 1)}-${Date.now()}`;

  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('Kengaytma javob bermadi'));
    }, timeoutMs);

    function onMessage(event: MessageEvent): void {
      if (event.origin !== location.origin || event.source !== window) return;

      const data = event.data as { source?: string; id?: string; payload?: unknown };
      if (data?.source !== 'looksave-extension' || data.id !== id) return;

      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);

      const payload = data.payload as (T & { error?: string }) | undefined;
      if (payload && typeof payload.error === 'string') {
        reject(new Error(payload.error));
        return;
      }

      resolve(payload as T);
    }

    window.addEventListener('message', onMessage);
    window.postMessage({ source: 'looksave-panel', id, request }, location.origin);
  });
}

export const status = (): Promise<{ status: RunStatus; authed: boolean }> =>
  send({ type: 'STATUS' });

export const start = (taskId: string, adapter: AdapterId): Promise<{ started: true }> =>
  send({ type: 'START', taskId, adapter });

export const setAuto = (enabled: boolean, adapter: AdapterId): Promise<{ auto: boolean }> =>
  send({ type: 'SET_AUTO', enabled, adapter });

/**
 * Sahifa tekshiruvi — navbatga tegmaydi, natija jurnalga yoziladi.
 *
 * ⚠️ TAYMAUT UZUNROQ: tekshiruv surat biriktirishni kutadi va bu
 * sekin aloqada 20 soniyagacha ketadi.
 */
export const diagnose = (adapter: AdapterId): Promise<{ diagnosed: true }> =>
  send({ type: 'DIAGNOSE', adapter }, 90_000);

export const stop = (): Promise<{ stopped: true }> => send({ type: 'STOP' });
