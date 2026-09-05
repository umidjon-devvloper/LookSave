import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Sinf nomlarini birlashtiradi.
 *
 * ⚠️ `twMerge` NI SOZLASH SHART, standarti YARAMAYDI.
 *
 * `tailwind-merge` sinfni nomiga qarab guruhga ajratadi va bir guruhdan
 * faqat oxirgisini qoldiradi. U bizning shkalamizni bilmaydi, shuning
 * uchun `text-body` ni RANG deb o'ylaydi — `text-foreground` bilan bitta
 * guruhga tushadi va o'chirib yuboriladi.
 *
 * Natijasi jim va aldamchi edi: tugmada `text-body` ham, `text-foreground`
 * ham yozilgan, lekin brauzerga faqat ikkinchisi yetib borardi va matn
 * 15px o'rniga 16px (`body` ning merosi) chiqardi. Sinf kodda ko'rinib
 * turgani uchun xatoni faqat `getComputedStyle` bilan topsa bo'lardi.
 *
 * Quyidagi ro'yxat presetdagi `fontSize` kalitlari bilan bir xil bo'lishi
 * kerak — biriga yangi o'lcham qo'shilsa, ikkinchisiga ham.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'display',
            'hero',
            'h1',
            'h2',
            'h3',
            'lead',
            'body',
            'small',
            'tiny',
            'label',
            'price',
            'wordmark',
          ],
        },
      ],
      /* `h-control` (52px) — `h-10` bilan almashinishi kerak, rang bilan emas */
      h: [{ h: ['control'] }],
    },
  },
});

/**
 * ⚠️ `apps/web/src/lib/utils.ts` DAGISINING NUSXASI EMAS — aksincha, o'sha
 * fayl shu yerdan qayta eksport qiladi. Ikki xil `cn` bo'lsa, sozlama
 * faqat bittasida qolib, xato yuqorida tasvirlangan shaklda qaytadi.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
