/**
 * Bildirishnoma bosilganda qaysi ekran ochilishini aniqlaydi.
 *
 * Sof mantiq — React Native import qilinmaydi, shuning uchun alohida
 * testlanadi (`pushTarget.test.ts`). Chaqiruvchi: `usePush.ts`.
 */

export type NotificationTarget = '/seller' | '/ai/fitting' | `/order/${string}`;

/** Bildirishnoma `data` si → ochiladigan marshrut; mos kelmasa `null`. */
export function notificationTarget(data: unknown): NotificationTarget | null {
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;

  /*
   * Do'kon buyurtmasi — sotuvchi panelga olib boriladi, mijoz buyurtma
   * sahifasiga EMAS. Ikkalasida ham `orderId` bor, shuning uchun tur
   * oldin tekshiriladi.
   */
  if (record['type'] === 'store_order') return '/seller';

  const orderId = record['orderId'];
  if (typeof orderId === 'string' && orderId.length > 0) return `/order/${orderId}`;

  /*
   * Avatar tayyor bo'lgani haqidagi xabar — operator navbati
   * (`developer_ai`) yo'li. Bosilganda kiyintirishga olib boramiz:
   * odam aynan shuning uchun kutgan edi.
   */
  if (record['type'] === 'avatar_ready') return '/ai/fitting';

  return null;
}
