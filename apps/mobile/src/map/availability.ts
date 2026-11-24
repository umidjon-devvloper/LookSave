import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Bu build'da xarita chizsa bo'ladimi?
 *
 * ⚠️ ANDROID'DA GOOGLE MAPS KALITISIZ `MapView` BUTUN ILOVANI O'LDIRADI.
 * 2026-11-18 da Android 16 emulyatorida takrorlandi: «Do'konlar → Xarita»
 * bosilishi bilan
 *
 *     java.lang.RuntimeException: API key not found. Check that
 *     <meta-data android:name="com.google.android.geo.API_KEY" …/>
 *
 * chiqadi, React xosti yopiladi va ekran BO'SH qoladi — jarayon tirik,
 * lekin ilovada hech narsa yo'q. Bu native istisno: `ScreenErrorBoundary`
 * uni ushlamaydi. Ilgari kodda «kalitsiz xarita bo'sh ko'rinadi, lekin
 * qulamaydi» deb yozilgan edi — endi bunday emas.
 *
 * Android'da `react-native-maps` uchun Google yagona provayder, shuning
 * uchun kalit bo'lmasa xarita UMUMAN chizilmaydi: do'konlar ro'yxat bo'lib
 * qoladi, checkout'da esa xarita o'rnida izoh turadi.
 *
 * ⚠️ KALIT BORLIGI `extra.androidMapsKey` DAN O'QILADI, `android.config` dan
 * emas: ilovaga joylanadigan ochiq konfiguratsiyadan `ios.config` va
 * `android.config` olib tashlanadi (ularda kalitlar turadi). Bayroqni
 * `app.config.ts` build paytida, kalitni manifestga yozgan joyning o'zida
 * qo'yadi. iOS'da standart provayder — Apple Maps, u kalitsiz ishlaydi.
 *
 * Xaritani yoqish: Google Cloud'da «Maps SDK for Android» kaliti yarating
 * (paket nomi + SHA-1 bilan cheklangan) va EAS'ga `GOOGLE_MAPS_ANDROID_KEY`
 * nomi bilan qo'shing — kod o'zgarmaydi.
 */
export const MAP_AVAILABLE: boolean =
  Platform.OS !== 'android' || Constants.expoConfig?.extra?.['androidMapsKey'] === true;
