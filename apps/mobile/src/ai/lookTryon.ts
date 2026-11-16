import { ApiError } from '../api/client';
import {
  getGarments,
  requestBundleRender,
  requestRender,
  type Garment,
  type TryonRender,
} from '../api/endpoints';
import { preferredVariant, sortedIds } from './lookTray';

/**
 * Look savati ↔ server: kiyimni aniqlash va kiyintirishni so'rash.
 *
 * `lookTray.ts` dan alohida, chunki bu yer tarmoqqa chiqadi — u yerdagi
 * qoidalar esa sof va sinaladi.
 */

/**
 * Mahsulot yoki variant id → kiyintirishga tayyor kiyim.
 *
 * ⚠️ HAR KIYIM ALOHIDA SO'RALADI — VA BU ATAYIN. Server `variantIds` da
 * mahsulot id ni ham qabul qiladi, lekin javob chegarasi yuborilgan id lar
 * soniga teng, mahsulotning esa HAMMA varianti qaytadi. Bir so'rovda uch
 * mahsulot yuborilsa va birinchisining uch rangi bo'lsa, javobni o'sha
 * uch rang to'ldirib, qolgan ikki mahsulot umuman kelmaydi. Bittadan
 * so'ralganda bunday siqib chiqarish bo'lmaydi.
 *
 * `null` — mahsulot endi yo'q (o'chirilgan yoki surati yo'q).
 */
export async function resolveGarment(ref: string): Promise<Garment | null> {
  const [row] = await getGarments({ variantIds: [ref] });
  if (!row) return null;

  const wanted = preferredVariant(ref, row);
  if (wanted === row.variantId) return row;

  // Mahsulotning asosiy rangi boshqa variant ekan — surati va o'lchamlari o'shaniki bo'lsin
  const [exact] = await getGarments({ variantIds: [wanted] });
  return exact ?? row;
}

export type TryonStart =
  | { kind: 'started'; render: TryonRender }
  /** Kunlik chegara tugagan — xato emas, holat */
  | { kind: 'limit' };

/**
 * Belgilangan kiyimlarni BIR YO'LA kiyintirishni so'raydi: bitta so'rov,
 * bitta rasm.
 *
 * Bitta kiyim uchun oddiy yo'l ishlatiladi — komplekt yo'li kamida ikkita
 * kiyim talab qiladi.
 *
 * ⚠️ QAYTGAN YOZUV — KUZATILADIGANI. Komplektda server har kiyimga bittadan
 * yozuv ochadi va natijani hammasiga yozadi, lekin XATO faqat birinchi
 * variantning yozuviga yoziladi (operator ishi unga bog'langan). Shuning
 * uchun id lar tartiblangan holda yuboriladi va birinchisi kuzatiladi.
 */
export async function startTryon(variantIds: readonly string[]): Promise<TryonStart> {
  const ids = sortedIds(variantIds);
  const [first] = ids;
  if (!first) throw new Error('Kiyim tanlanmagan');

  if (ids.length === 1) {
    try {
      return { kind: 'started', render: await requestRender(first, 'front', null) };
    } catch (err) {
      if (err instanceof ApiError && err.code === 'RATE_LIMITED') return { kind: 'limit' };
      throw err;
    }
  }

  const result = await requestBundleRender(ids, 'front');
  if (result.limitReached) return { kind: 'limit' };

  const render = result.renders.find((item) => item.variantId === first) ?? result.renders[0];
  if (!render) throw new Error('Server kiyintirish yozuvini qaytarmadi');

  return { kind: 'started', render };
}
