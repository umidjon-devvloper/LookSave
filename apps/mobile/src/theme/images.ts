/* eslint-disable @typescript-eslint/no-require-imports --
 * React Native'da lokal rasm `require()` bilan ulanadi: Metro shu chaqiruvni
 * ko'rib faylni bundle'ga qo'shadi va o'lchamini oldindan biladi. `import`
 * bilan yozilsa TypeScript `.png` modulini tanimaydi. Bu — RN'ning standart
 * usuli, shuning uchun qoida faqat shu faylda o'chirilgan.
 */
import type { ImageSourcePropType } from 'react-native';

/**
 * Ilova ichiga joylashtirilgan bezak rasmlari (deck 01 va 07-slayd).
 *
 * NEGA BIR JOYDA: ekranlar faqat kalitni biladi, rasmni almashtirish uchun
 * bitta fayl tahrirlanadi.
 *
 * ⚠️ Bu rasmlar bundle hajmiga qo'shiladi. Admin panel orqali boshqariladigan
 * bo'lgach ular R2 dan URL bilan keladi, bu fayl esa zaxira bo'lib qoladi.
 *
 * ⚠️ FORMAT — JPEG, PNG EMAS. Bular fotosurat, PNG esa yo'qotishsiz siqadi:
 * fotosuratda qo'shni piksellar deyarli hech qachon bir xil bo'lmaydi va
 * PNG ularning har birini saqlashga majbur. Natijada 1254×1254 rasm 1.9 MB
 * bo'lardi — bir xil o'lchamdagi JPEG esa 0.3 MB.
 *
 * Bu telefonda sezilardi: rasmlar kech kelardi va ochilishda qotib qolardi.
 * Yettita rasm birgalikda 12.9 MB edi, hozir 1.8 MB.
 *
 * Piksel o'lchamlariga TEGILMAGAN — faqat format almashtirilgan, shuning
 * uchun aniqlik aynan avvalgidek.
 *
 * ⚠️ ISTISNOLAR — bu ikkisi PNG bo'lib qolishi SHART:
 *   `logo.png`      — ilova ikonkasi (`app.json`), iOS faqat PNG qabul qiladi
 *   `logo-mark.png` — shaffof foni bor, JPEG shaffoflikni saqlay olmaydi
 */
export const images = {
  /** "LS" belgisi — qora foni shaffofga aylantirilgan (sarlavha va splash uchun) */
  logoMark: require('../../assets/logo-mark.png') as ImageSourcePropType,
  heroHome: require('../../assets/hero-home.jpg') as ImageSourcePropType,
  /** AI Designer kirish ekranidagi gologramma — markaziy figura kesib olinadi */
  aiHologram: require('../../assets/3d-person.jpg') as ImageSourcePropType,
  heroMarket: require('../../assets/hero-market.jpg') as ImageSourcePropType,
  collectionMen: require('../../assets/collection-men.jpg') as ImageSourcePropType,
  collectionWomen: require('../../assets/collection-women.jpg') as ImageSourcePropType,
  collectionLimited: require('../../assets/collection-limited.jpg') as ImageSourcePropType,
} as const;
