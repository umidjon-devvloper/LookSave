import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * `app.json` ustiga muhitdan keladigan sozlamalar.
 *
 * NEGA KERAK: Google Maps kaliti **native konfiguratsiyaga** yoziladi,
 * ya'ni build paytida kerak — `EXPO_PUBLIC_*` orqali ish vaqtida
 * o'qib bo'lmaydi. Kalitni `app.json` ga yozib qo'yish esa uni repoga
 * kiritish demak.
 *
 * Kalitlar `eas.json` dagi profil `env` ida yoki EAS Secrets'da turadi:
 *
 *   eas secret:create --name GOOGLE_MAPS_ANDROID_KEY --value AIza…
 *   eas secret:create --name GOOGLE_MAPS_IOS_KEY --value AIza…
 *
 * ⚠️ Kalit berilmasa build baribir o'tadi va ilova ishga tushadi, lekin
 * Android'da xarita CHIZILMAYDI: `MapView` kalitsiz ochilsa butun ilova
 * bo'sh ekranga tushadi (2026-11-18 da emulyatorda takrorlandi), shuning
 * uchun ilova uni yashiradi (`extra.androidMapsKey`, `src/map/availability.ts`).
 * Pastda ogohlantirish chiqariladi.
 *
 * Kalitni Google Cloud'da cheklang: Android uchun paket nomi + SHA-1,
 * iOS uchun bundle ID. Places API YOQILMAYDI (K-05) — faqat
 * "Maps SDK for Android" va "Maps SDK for iOS".
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const androidKey = process.env['GOOGLE_MAPS_ANDROID_KEY'];
  const iosKey = process.env['GOOGLE_MAPS_IOS_KEY'];

  if (!androidKey && !iosKey) {
    console.warn(
      '[app.config] Google Maps kaliti yo`q — xarita ekrani bo`sh ko`rinadi. ' +
        'GOOGLE_MAPS_ANDROID_KEY / GOOGLE_MAPS_IOS_KEY ni sozlang (RUNBOOK §5).',
    );
  }

  return {
    ...config,
    name: config.name ?? 'LookSave',
    slug: config.slug ?? 'looksave',
    extra: {
      ...config.extra,
      /*
       * Ish vaqtida «Android'da xarita chizsa bo'ladimi?» savoliga javob
       * (`src/map/availability.ts`). Kalitning o'zi ilovaga joylanadigan
       * ochiq konfiguratsiyaga tushmaydi (`android.config` undan olib
       * tashlanadi), shuning uchun faqat bor-yo'qligi yoziladi.
       */
      androidMapsKey: Boolean(androidKey),
    },
    android: {
      ...config.android,
      ...(androidKey ? { config: { googleMaps: { apiKey: androidKey } } } : {}),
    },
    ios: {
      ...config.ios,
      ...(iosKey ? { config: { googleMapsApiKey: iosKey } } : {}),
    },
  };
};
