/**
 * @looksave/shared-types — API kontrakti.
 *
 * Bu paket TypeScript **manba** ko'rinishida eksport qilinadi (build yo'q):
 * API tsup bilan bundle qiladi, Vite esbuild bilan, Metro babel bilan.
 * Shuning uchun bu yerda faqat tip va sof funksiyalar bo'lishi kerak —
 * Node'ga xos modul (fs, crypto) import qilinmaydi, aks holda mobil build buziladi.
 */
export * from './api';
export * from './errors';
export * from './auth';
