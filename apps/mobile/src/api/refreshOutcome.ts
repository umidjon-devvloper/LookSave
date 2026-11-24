/**
 * Token yangilash natijasi — HTTP holatidan.
 *
 * ⚠️ UCH HOLAT, IKKI EMAS (2026-11-24). Ilgari har qanday 2xx bo'lmagan javob
 * (429 «juda ko'p so'rov», 502 — server qayta ishga tushayotgan paytda, 5xx)
 * sessiyani O'CHIRARDI: foydalanuvchi hech narsa qilmagan holda tizimdan
 * chiqib qolardi, ilova esa hali «kirgan» deb ko'rsatardi va har ekranda
 * «Sessiya tugadi» chiqardi.
 *
 * - `ok`          — yangi tokenlar keldi;
 * - `rejected`    — server tokenni RAD ETDI (401/403): sessiya haqiqatan
 *                   tugagan, tokenlar o'chiriladi;
 * - `unreachable` — server vaqtincha javob bera olmadi: tokenlar SAQLANADI,
 *                   keyinroq qayta urinamiz.
 *
 * Sof modul (React Native import qilinmaydi) — `refreshOutcome.test.ts`.
 */
export type RefreshResult = 'ok' | 'rejected' | 'unreachable';

export function refreshOutcome(status: number): RefreshResult {
  if (status >= 200 && status < 300) return 'ok';
  return status === 401 || status === 403 ? 'rejected' : 'unreachable';
}
