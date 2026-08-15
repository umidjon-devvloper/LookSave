/**
 * Koordinata bilan ishlash. Sof funksiyalar — xarita kutubxonasiga
 * bog'liq emas, shuning uchun kalitsiz ham, testda ham ishlaydi.
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

/** Toshkent markazi — xarita ochilganda boshlang'ich nuqta. */
export const TASHKENT: Coordinates = { lat: 41.3111, lng: 69.2797 };

/** Dubay markazi — `country === 'AE'` tanlanganda. */
export const DUBAI: Coordinates = { lat: 25.2048, lng: 55.2708 };

export function defaultCenter(country: 'UZ' | 'AE'): Coordinates {
  return country === 'AE' ? DUBAI : TASHKENT;
}

export function isValid(coords: Coordinates): boolean {
  return (
    Number.isFinite(coords.lat) &&
    Number.isFinite(coords.lng) &&
    coords.lat >= -90 &&
    coords.lat <= 90 &&
    coords.lng >= -180 &&
    coords.lng <= 180 &&
    // (0, 0) — Gvineya ko'rfazi. Bu deyarli har doim "to'ldirilmagan"
    // degani, do'kon u yerda bo'lishi mumkin emas
    !(coords.lat === 0 && coords.lng === 0)
  );
}

/**
 * Google Maps'dan ko'chirilgan matnni o'qish: `41.311081, 69.279737`.
 * Xarita kaliti bo'lmaganda yagona yo'l shu, shuning uchun qoladi.
 */
export function parseCoordinates(input: string): Coordinates | null {
  const match = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const coords = { lat: Number(match[1]), lng: Number(match[2]) };
  return isValid(coords) ? coords : null;
}

/**
 * Ko'rsatish uchun matn. Olti kasr — ~11 sm aniqlik, do'kon uchun
 * ortig'i bilan yetadi va uzun raqam ekranga sig'maydi.
 */
export function formatCoordinates(coords: Coordinates): string {
  return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
}

/**
 * Xarita kaliti sozlanganmi.
 *
 * ⚠️ Bu ALOHIDA kalit — mobil ilovadagi Android/iOS kalitlari yaramaydi.
 * Web uchun "Maps JavaScript API" yoqilishi va kalit HTTP referrer
 * bo'yicha cheklanishi kerak (panel domeni).
 */
export function mapsApiKey(): string | null {
  const key = import.meta.env['VITE_GOOGLE_MAPS_KEY'];
  return typeof key === 'string' && key.length > 0 ? key : null;
}
