/**
 * Google Maps kaliti — `apps/store-panel/src/lib/coords.ts` bilan bir xil
 * qoida: kalit YO'Q bo'lsa sahifa buzilmaydi, xarita o'rniga ro'yxat
 * to'liq ishlayveradi.
 *
 * ⚠️ Bu ALOHIDA kalit — mobil ilovadagi Android/iOS kalitlari yaramaydi.
 * Web uchun "Maps JavaScript API" yoqiladi va kalit HTTP referrer bo'yicha
 * cheklanadi (sayt domeni). Places API yoqilmaydi (00-README K-05):
 * qidiruv PostGIS'da, do'konlar o'z bazamizda.
 */
export function mapsApiKey(): string | null {
  const key = import.meta.env['VITE_GOOGLE_MAPS_KEY'];
  return typeof key === 'string' && key.length > 0 ? key : null;
}
