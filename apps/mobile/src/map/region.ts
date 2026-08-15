/**
 * Xarita mintaqasi bilan bog'liq hisoblar (03-api-spec §8).
 *
 * Sof: `react-native-maps` import qilinmaydi, shuning uchun testda
 * qurilma kerak emas. Bu yerdagi uchta qaror xaritaning butun xatti-
 * harakatini belgilaydi: qaysi chegara so'raladi, qaysi zoom yuboriladi,
 * qachon qayta so'rov qilinadi.
 */

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface Bounds {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
  zoom: number;
}

/** Kenglik ±90 dan chiqmasin, uzunlik ±180 dan. */
function clampLat(value: number): number {
  return Math.min(90, Math.max(-90, value));
}

function clampLng(value: number): number {
  return Math.min(180, Math.max(-180, value));
}

/**
 * Ko'rinib turgan mintaqa → zoom darajasi.
 *
 * Google Maps'da zoom 0 da butun dunyo (360°) ekranga sig'adi, har
 * daraja ikki barobar yaqinlashtiradi. Server 12 dan boshlab marker,
 * undan past bo'lsa klaster qaytaradi.
 */
export function zoomFromDelta(longitudeDelta: number): number {
  if (longitudeDelta <= 0) return 21;

  const zoom = Math.round(Math.log2(360 / longitudeDelta));
  return Math.min(21, Math.max(1, zoom));
}

/**
 * Mintaqa → so'rov chegarasi.
 *
 * `padding` — ko'rinadigan maydondan biroz kengroq so'raymiz, shunda
 * foydalanuvchi chetga surganda markerlar darhol paydo bo'ladi va
 * har kichik harakatda yangi so'rov ketmaydi.
 */
export function regionToBounds(region: Region, padding = 0.15): Bounds {
  const latPad = (region.latitudeDelta / 2) * (1 + padding);
  const lngPad = (region.longitudeDelta / 2) * (1 + padding);

  return {
    swLat: clampLat(region.latitude - latPad),
    swLng: clampLng(region.longitude - lngPad),
    neLat: clampLat(region.latitude + latPad),
    neLng: clampLng(region.longitude + lngPad),
    zoom: zoomFromDelta(region.longitudeDelta),
  };
}

/**
 * Qayta so'rov kerakmi.
 *
 * Xarita surilganda `onRegionChangeComplete` juda tez-tez chaqiriladi.
 * Har safar so'rov yuborilsa mobil tarmoqda trafik ham, batareya ham
 * ketadi. Shuning uchun: zoom o'zgargan bo'lsa — albatta; markaz
 * ko'rinadigan maydonning uchdan biridan ko'proq siljigan bo'lsa — ha;
 * aks holda yo'q.
 */
export function shouldRefetch(previous: Region | null, next: Region): boolean {
  if (previous === null) return true;

  if (zoomFromDelta(previous.longitudeDelta) !== zoomFromDelta(next.longitudeDelta)) {
    return true;
  }

  const latMoved = Math.abs(previous.latitude - next.latitude);
  const lngMoved = Math.abs(previous.longitude - next.longitude);

  return latMoved > next.latitudeDelta / 3 || lngMoved > next.longitudeDelta / 3;
}

/**
 * Klasterga bosilganda qanchalik yaqinlashamiz.
 *
 * Ikki barobar — klaster bir bosishda tarqalmasligi mumkin, lekin
 * foydalanuvchi qayerga borayotganini yo'qotmaydi. To'g'ridan-to'g'ri
 * marker darajasiga sakrash chalkashtiradi.
 */
export function zoomIntoCluster(region: Region, lat: number, lng: number): Region {
  return {
    latitude: lat,
    longitude: lng,
    latitudeDelta: Math.max(0.002, region.latitudeDelta / 2),
    longitudeDelta: Math.max(0.002, region.longitudeDelta / 2),
  };
}

/** Foydalanuvchi joylashuvi atrofidagi boshlang'ich mintaqa — ~3 km. */
export function initialRegion(coords: { lat: number; lng: number }): Region {
  return {
    latitude: coords.lat,
    longitude: coords.lng,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  };
}
