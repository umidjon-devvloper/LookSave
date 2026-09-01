import { FittingExperience } from '../../src/components/ai/FittingExperience';

/**
 * «Kiyib ko'rish» tabi.
 *
 * ⚠️ BU EKRAN 3D EDI — ENDI EMAS. Ilgari shu yerda `three.js` sahnasi
 * turardi: avatar modeli va unga kiydiriladigan GLB kiyimlar. U ishlardi,
 * lekin natija ko'rgazmali emas edi — protsedural avatar va oz sonli
 * kiyim modeli bilan tasvir «o'yinchoq» bo'lib chiqardi va foydalanuvchi
 * o'zini tanimasdi.
 *
 * Sotuvchi tomonidan ham qimmat edi: har mahsulot uchun 3D model kerak
 * bo'lardi. Endi sotuvchi oddiy surat va o'lchamlarni kiritadi, kiyintirish
 * esa AI orqali suratda bajariladi (`apps/api/src/integrations/openai.ts`).
 *
 * ⚠️ THREE.JS HAM KETDI. Svayp avval unga qurilgan edi, lekin GL ikki
 * joyda yiqildi: ba'zi qurilmalarda JIM chizmaydi (xato bermaydi) va
 * fon olib tashlangan SHAFFOF PNG ni Hermes'da ocha olmaydi. Endi svayp
 * React Native'ning o'z `perspective` transformida —
 * `src/components/ai/PhotoSwipe.tsx`. Ko'rinish o'sha, ishonchliligi
 * boshqa.
 */
export default function TryOnTab(): JSX.Element {
  return <FittingExperience />;
}
