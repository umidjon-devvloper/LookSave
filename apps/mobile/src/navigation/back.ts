import { router, type Href } from 'expo-router';

/**
 * Orqaga qaytadi; qaytadigan joy bo'lmasa zaxira ekranga o'tadi.
 *
 * ⚠️ NEGA KERAK. `router.back()` tarix bo'sh bo'lganda ishlamaydi va
 * konsolga «The action 'GO_BACK' was not handled by any navigator»
 * chiqaradi. Foydalanuvchi uchun bu shundan ham yomonroq: tugma
 * bosiladi va HECH NARSA bo'lmaydi — ekran qamalib qoladi.
 *
 * Tarix uch holatda bo'sh bo'ladi:
 *   • ekran deep link orqali ochilgan (bildirishnoma, havola)
 *   • undan oldin `router.replace` ishlatilgan — u tarixni yo'q qiladi
 *   • ilova o'sha ekrandan qayta tiklangan
 *
 * ⚠️ HAR CHAQIRUVDA ZAXIRA BERILISHI KERAK. Sukut `/` bo'lardi, lekin
 * u ko'pincha noto'g'ri joy: sozlamalardan chiqqan odam bosh sahifaga
 * emas, profilga tushishi kerak. Shuning uchun majburiy parametr —
 * chaqiruvchi o'ylab tanlasin.
 */
export function goBack(fallback: Href): void {
  /*
   * ⚠️ ZAXIRA HAQIQIY EKRAN BO'LSIN, YO'NALTIRUVCHI EMAS. `'/'` bergan
   * edim va ilova splash'da qotib qoldi: `app/index.tsx` faqat
   * `<Redirect href="/(tabs)" />` qaytaradi, `(tabs)` guruhi esa o'zi
   * ham `/` ga xaritalanadi — natijada halqa hosil bo'ldi.
   *
   * Shuning uchun tab ekranlariga `'/(tabs)'` yoki aniq tab nomi
   * (`'/cart'`, `'/profile'`) beriladi.
   */
  if (router.canGoBack()) {
    router.back();
    return;
  }

  /*
   * `replace`, `push` emas: zaxira ekran tarixga qo'shilmasligi kerak,
   * aks holda undan orqaga bosilganda yana shu qamalgan ekranga
   * qaytardi.
   */
  router.replace(fallback);
}
