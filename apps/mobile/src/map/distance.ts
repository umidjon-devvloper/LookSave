export interface Point {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Ikki nuqta orasidagi masofa (metr), haversine formulasi.
 *
 * NEGA ILOVADA HISOBLANADI: `GET /stores/nearby` masofani serverda
 * (PostGIS) hisoblaydi va u aniqroq. Lekin `GET /stores/map` faqat
 * koordinata qaytaradi — uzoqdagi do'konlarni ro'yxatga qo'shganda
 * masofani boshqa joydan olib bo'lmaydi.
 *
 * ⚠️ Haversine Yerni ideal shar deb oladi, shuning uchun xato ~0.5%
 * gacha yetadi. Ro'yxatni tartiblash va "12 km" deb ko'rsatish uchun
 * bu yetarli; yetkazib berish narxini bunga qarab hisoblamang.
 */
export function distanceMeters(from: Point, to: Point): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}
