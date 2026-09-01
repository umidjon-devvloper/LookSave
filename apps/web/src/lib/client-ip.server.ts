/**
 * Mehmonning IP'si — `loader`/`action` ga kelgan so'rovdan.
 *
 * ⚠️ NEGA UMUMAN KERAK. Sayt SSR bilan ishlaydi: API ga so'rov
 * mehmondan emas, VEB-SERVERDAN boradi. API esa anonim cheklovni IP
 * bo'yicha hisoblaydi — natijada BARCHA mehmon daqiqasiga 30 ta
 * so'rovlik bitta chelakni bo'lishadi va bir necha kishi bir vaqtda
 * kirsa sahifalar bo'sh ochiladi (15-sayt-dizayn.md S-4).
 *
 * ⚠️ `.server.ts` MAJBURIY: bu fayl brauzer to'plamiga tushmaydi.
 *
 * ⚠️ ISHONCH ANIQ SOZLANADI, TAXMIN QILINMAYDI. Sarlavhani mijozning
 * o'zi ham yozib yuborishi mumkin. Qaysi sarlavhaga ishonish
 * DEPLOYGA bog'liq, shuning uchun `WEB_TRUST_PROXY` bilan aytiladi.
 * Sozlanmagan bo'lsa IP UMUMAN OLINMAYDI va cheklov eskicha
 * veb-server IP'si bo'yicha ishlaydi — noto'g'ri IP'ga ishonib
 * cheklovni butunlay yo'qqa chiqargandan ko'ra shunisi xavfsiz.
 */

/**
 * `WEB_TRUST_PROXY`:
 *
 *   `cloudflare`  — Cloudflare Workers/Pages. `CF-Connecting-IP` ni
 *                   Cloudflare O'ZI yozadi va mijoznikini har doim
 *                   almashtiradi, ya'ni soxtalashtirib bo'lmaydi.
 *                   Sayt shu yerga chiqadi (13-sayt.md S-03).
 *   `1`, `2`, …   — oldida shuncha ishonchli proksi bor (Caddy, ALB).
 *                   `X-Forwarded-For` OXIRIDAN shuncha-inchi qiymat
 *                   olinadi — Express `trust proxy` bilan bir xil
 *                   hisob, ikki xil model bo'lmasin.
 *   bo'sh / `0`   — proksi yo'q (dev). IP olinmaydi.
 */
const TRUST = (process.env['WEB_TRUST_PROXY'] ?? '').trim().toLowerCase();

/** `1.2.3.4` yoki `::1` — qo'pol, lekin yetarli tekshiruv. */
function looksLikeIp(value: string): boolean {
  if (value.length === 0 || value.length > 45) return false;
  return /^[0-9a-f.:]+$/i.test(value) && /[.:]/.test(value);
}

/**
 * `X-Forwarded-For` dagi qiymatlar: `mijoz, proksi1, proksi2…`.
 * Har bir proksi o'zi ko'rgan IP'ni OXIRIGA qo'shadi, demak
 * `hops` ta proksiga ishonsak mijoz oxiridan `hops`-o'rinda turadi.
 */
function fromForwardedFor(header: string, hops: number): string | null {
  const entries = header
    .split(',')
    .map((part) => part.trim())
    .filter(looksLikeIp);

  // Ro'yxat kutilganidan qisqa — sozlama noto'g'ri yoki sarlavha
  // qirqilgan. Taxmin qilmaymiz.
  if (entries.length < hops) return null;
  return entries[entries.length - hops] ?? null;
}

/** Mehmon IP'si yoki `null` (ishonchli manba yo'q). */
export function clientIp(request: Request): string | null {
  if (TRUST === '' || TRUST === '0' || TRUST === 'none') return null;

  if (TRUST === 'cloudflare') {
    const value = request.headers.get('CF-Connecting-IP')?.trim();
    return value && looksLikeIp(value) ? value : null;
  }

  const hops = Number(TRUST);
  if (!Number.isInteger(hops) || hops < 1) return null;

  const header = request.headers.get('X-Forwarded-For');
  return header ? fromForwardedFor(header, hops) : null;
}
