/**
 * Formatlash — mobil `src/theme/format.ts` bilan **bir xil natija**
 * berishi shart, aks holda bir mahsulot ikki joyda boshqacha narxda
 * ko'rinadi.
 *
 * ⚠️ WEB-02 da bu fayl `packages/i18n` ga ko'chadi va ikkala platforma
 * bitta manbadan o'qiydi. Hozircha nusxa — va u ATAYIN mobil'dagi
 * mantiqni qatorma-qator takrorlaydi.
 */

/** Pul serverdan string bo'lib keladi va string bo'lib qoladi. */
export function money(amount: string, currency: string): string {
  const [whole = '0'] = amount.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return currency === 'UZS' ? `${grouped} so'm` : `${grouped} ${currency}`;
}

/**
 * Masofa: 850 m · 3.2 km
 *
 * ⚠️ JUDA UZOQ MASOFA UMUMAN KO'RSATILMAYDI. Foydalanuvchi joylashuvga
 * ruxsat bermasa yoki boshqa mamlakatda bo'lsa «11170.2 km» kabi raqam
 * chiqadi — bu foydasiz va sayt buzuqdek ko'rinadi.
 */
const MAX_USEFUL_DISTANCE_M = 300_000;

export function distance(meters: number | null): string {
  if (meters === null || meters > MAX_USEFUL_DISTANCE_M) return '';
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function phone(value: string): string {
  const match = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(value);
  return match ? `+998 ${match[1]} ${match[2]} ${match[3]} ${match[4]}` : value;
}

/** Chegirma foizi — `-35%`. Eski narx yo'q yoki kichik bo'lsa `null`. */
export function discount(price: string, oldPrice: string | null): string | null {
  if (!oldPrice) return null;
  const now = Number.parseFloat(price);
  const before = Number.parseFloat(oldPrice);
  if (!Number.isFinite(now) || !Number.isFinite(before) || before <= now) return null;
  return `-${Math.round((1 - now / before) * 100)}%`;
}
