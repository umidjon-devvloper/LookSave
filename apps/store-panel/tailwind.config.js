import preset from '@looksave/design-system/tailwind-preset';

/** @type {import('tailwindcss').Config} */
/*
 * Ranglar, radiuslar, animatsiyalar — hammasi presetda
 * (`packages/design-system/tailwind-preset.js`).
 *
 * Panel varianti saytdan ikki narsa bilan farq qiladi:
 *   fon `--panel` (bir zina ochiq, uzoq ishlashga qulay) va asos shrift 14px —
 *   panelda ma'lumot zichligi yuqori.
 *
 * ⚠️ `npx shadcn add` bu faylga keyframes/animation qo'shib yuboradi —
 * ular presetda allaqachon bor, takrorini o'chirib tashlang.
 */
export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { background: 'hsl(var(--panel) / <alpha-value>)' },
      fontSize: { base: ['14px', '20px'] },
    },
  },
};
