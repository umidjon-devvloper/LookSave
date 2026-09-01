import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * ⚠️ `@vitejs/plugin-react` YO'Q — `reactRouter()` uni o'z ichiga oladi.
 * Ikkalasi birga qo'yilsa React ikki marta o'zgartiriladi va HMR buziladi.
 *
 * `@/...` yo'llari `tsconfig.json` dagi `paths` dan olinadi
 * (`vite-tsconfig-paths`), ya'ni endi ikki joyda takrorlanmaydi.
 */
export default defineConfig({
  plugins: [reactRouter(), tsconfigPaths()],

  server: {
    /*
     * 5173 — store-panel, 5174 — admin-panel. Uchalasi birga ishlashi kerak,
     * shuning uchun standart qiymat belgilangan.
     *
     * ⚠️ LEKIN `PORT` USTUN TURADI. Bir nechta sessiya bir vaqtda ishlaganda
     * 5175 band bo'lishi mumkin va qattiq port serverni umuman ko'tarilmay
     * qo'yadi. Bu yerda erkin port xavfsiz: sayt `/v1` ni proksilaydi, ya'ni
     * CORS ishlatilmaydi (`apps/api/.env` dagi `CORS_ORIGINS` da 5175 yo'q)
     * va tashqaridan qaytadigan manzil (OAuth, webhook) ham yo'q.
     *
     * Panellarda bunday emas va bo'lmasligi ham kerak: ular `CORS_ORIGINS`
     * da aynan 5173/5174 deb sanalgan.
     */
    port: Number(process.env.PORT) || 5175,
    /*
     * Proksi BRAUZER tomonidagi so'rovlar uchun qoladi. `loader` va
     * `action` ichidagi so'rovlar Node'da ishlaydi va API ga bevosita
     * boradi (`src/api/client.ts`), ya'ni ular bu yerga tegmaydi.
     */
    proxy: {
      '/v1': { target: 'http://127.0.0.1:3000', changeOrigin: true },
    },
  },

  /*
   * ⚠️ SSR UCHUN MAJBURIY. Radix paketlari CommonJS ko'rinishida
   * tarqatiladi va Node ularning nomlangan eksportlarini (`Slot`,
   * `Root`…) ko'ra olmaydi — natijada har sahifa 500 qaytaradi.
   *
   * `noExternal` Vite'ga ularni serverda ham BUNDLE qilishni aytadi,
   * shunda interop Vite tomonidan hal qilinadi.
   *
   * Ro'yxat ataylab tor: `noExternal: true` hammasini bundle qiladi va
   * Node'ga xos paketlar (fs, crypto ishlatadiganlari) buziladi.
   */
  ssr: {
    noExternal: [
      /^@radix-ui\//,
      'lucide-react',
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
      'sonner',
      'next-themes',
    ],
  },

  build: { sourcemap: true },
});
