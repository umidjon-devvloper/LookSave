import preset from '@looksave/design-system/tailwind-preset';

/** @type {import('tailwindcss').Config} */
/*
 * Ranglar, radiuslar, animatsiyalar — hammasi presetda
 * (`packages/design-system/tailwind-preset.js`). Bu yerda faqat marketing
 * saytiga xos farqlar qoladi.
 *
 * ⚠️ PANEL VARIANTIDAN FARQI: bu marketing sayti, ma'lumot paneli emas.
 * Shuning uchun asos shrift 16px (panelda 14px) va `shadow-glow` ishlatiladi —
 * deckdagi "nurlanuvchi binafsha" hissi aynan shundan keladi.
 *
 * ⚠️ `npx shadcn add` bu faylga keyframes/animation qo'shib yuboradi —
 * ular presetda allaqachon bor, takrorini o'chirib tashlang.
 */
export default {
  presets: [preset],
  /*
   * ⚠️ `packages/ui-web` SHART. Tailwind sinflarni faqat `content` da
   * sanab o'tilgan fayllarni o'qib topadi — kit paket ichida yozilgani
   * uchun uni qo'shmasak, `h-control` va `bg-primary-grad` umuman
   * yaratilmaydi va tugma bezaksiz chiqadi.
   */
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/ui-web/src/**/*.{ts,tsx}'],
};
