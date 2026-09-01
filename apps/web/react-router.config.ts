import type { Config } from '@react-router/dev/config';

/**
 * React Router v7, framework rejimi (docs/13-sayt.md S-02).
 *
 * ⚠️ `ssr: true` — bu qaror SEO uchun: mahsulot sahifasi serverda
 * chizilmasa Google uni ko'pincha indekslamaydi, marketplace uchun esa
 * aynen o'sha sahifa muhim.
 *
 * Yon foydasi: `loader` Node'da ishlaydi va API ga to'g'ridan-to'g'ri
 * murojaat qiladi — brauzer hech qachon `api.looksave.app` bilan
 * gaplashmaydi, ya'ni CORS ham, tokenni JS'da saqlash ham kerak emas
 * (13-sayt.md §9, BFF).
 *
 * ⚠️ `appDirectory: 'src'` — standart `app/` emas. Repo'dagi uchala veb
 * ilova `src/` ishlatadi; bittasini boshqacha qilish keyin har safar
 * «bu qayerda edi?» degan savol tug'diradi.
 */
export default {
  appDirectory: 'src',
  ssr: true,
} satisfies Config;
