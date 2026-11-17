import { shortDate } from '../theme/format';
import type { Dictionary } from './dictionaries';

/**
 * Yetkazish vaqtini qurilma tilida ko'rsatadi.
 *
 * ⚠️ SERVER BUNI TAYYOR O'ZBEKCHA MATN QILIB BERADI
 * (`apps/api/src/orders/delivery-when.ts`): «Bugun», «Ertaga kun davomida»,
 * «Tanlangan kun» yoki sana (`YYYY-MM-DD`). Ilova uni o'zgarishsiz chiqarardi
 * va inglizcha qurilmada buyurtma kartasida «Delivery · Bugun» turardi —
 * xaridorda ham, sotuvchi panelida ham.
 *
 * Notanish qiymat o'z holicha qaytadi: server yangi yozuv qo'shsa, u
 * yo'qolib qolgandan ko'ra tarjimasiz ko'ringani yaxshi.
 */
export function deliveryWhenText(
  t: Dictionary,
  locale: string,
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  if (raw === 'Bugun') return t.checkout.today;
  if (raw.startsWith('Ertaga')) return t.checkout.tomorrow;
  if (raw === 'Tanlangan kun') return t.checkout.scheduled;
  // Tush payti olinadi: yarim tun UTC bo'lsa g'arbiy vaqt mintaqasida kun bittaga ortga suriladi
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return shortDate(`${raw}T12:00:00`, locale);
  return raw;
}
