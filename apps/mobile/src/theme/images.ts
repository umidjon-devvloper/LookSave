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
 */
export const images = {
  /** "LS" belgisi — qora foni shaffofga aylantirilgan (sarlavha va splash uchun) */
  logoMark: require('../../assets/logo-mark.png') as ImageSourcePropType,
  heroHome: require('../../assets/hero-home.png') as ImageSourcePropType,
  heroMarket: require('../../assets/hero-market.png') as ImageSourcePropType,
  collectionMen: require('../../assets/collection-men.png') as ImageSourcePropType,
  collectionWomen: require('../../assets/collection-women.png') as ImageSourcePropType,
  collectionLimited: require('../../assets/collection-limited.png') as ImageSourcePropType,
} as const;
