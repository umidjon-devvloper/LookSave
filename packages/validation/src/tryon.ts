import { GARMENT_STYLES } from './store-products';
import { z } from 'zod';

import { cursorSchema, uuidSchema } from './common';

/** Kiyim tanada qaysi joyga tushadi (02-database: categories.slot). */
export const slotSchema = z.enum([
  'head',
  'face',
  'neck',
  'top',
  'outer',
  'bottom',
  'feet',
  'wrist',
  'bag',
]);

export type Slot = z.output<typeof slotSchema>;

/**
 * AI kiyintirish qaysi slotlarda ishlaydi.
 *
 * ⚠️ MODEL FAQAT KIYIM UCHUN O'QITILGAN. Oyoq kiyim, soat, sumka va bosh
 * kiyimda natija ishonchsiz chiqadi — ularni AI'ga yubormaymiz va oddiy
 * mahsulot suratini ko'rsatamiz. Pul ham, foydalanuvchining ishonchi ham
 * behuda ketmaydi.
 *
 * ⚠️ NEGA SHU YERDA, ILOVADA EMAS. Ro'yxat ilgari faqat mobil tomonda
 * edi, server esa uni bilmasdi — natijada katalogdagi «kiyib ko'rish
 * mumkin» belgisi va serverning haqiqiy qarori bir-biridan ajralib
 * ketishi mumkin edi. Endi manba bitta va ikkala tomon shundan o'qiydi.
 */
export const AI_TRYON_SLOTS: readonly Slot[] = ['top', 'outer', 'bottom', 'feet'];

export function supportsAiTryon(slot: string): boolean {
  return (AI_TRYON_SLOTS as readonly string[]).includes(slot);
}

/**
 * Svayp uchun ro'yxat. Ilova buni butunlay xotirada saqlaydi va
 * svayp qilganda tarmoqqa chiqmaydi (03-api-spec §10) — shuning uchun
 * limit katta: 100 tagacha.
 */
export const tryonSlotQuerySchema = z.object({
  gender: z.enum(['male', 'female', 'unisex']).optional(),
  storeId: uuidSchema.optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().int().min(100).max(50_000).default(10_000),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: cursorSchema.optional(),
});

export const tryonEventSchema = z.object({
  variantId: uuidSchema,
  durationMs: z.number().int().min(0).max(3_600_000).optional(),
});

export const lookItemSchema = z.object({
  slot: slotSchema,
  variantId: uuidSchema,
  size: z.string().trim().min(1).max(10).optional(),
});

/**
 * AI Designer so'rovi — tadbir, uslub va byudjet.
 *
 * ⚠️ HAMMASI IXTIYORIY EMAS: tadbir va uslub SHART, chunki ularsiz
 * taklif tasodifiy ro'yxatga aylanadi va «AI siz uchun tanladi» degan
 * va'da bo'sh bo'lib qoladi.
 */
export const suggestLookSchema = z.object({
  occasion: z.string().trim().min(1).max(40),
  style: z.string().trim().min(1).max(40),
  gender: z.enum(['male', 'female', 'unisex']).optional(),
  // Umumiy narx chegarasi. Pul butun songda — tiyin yo'q
  budget: z.coerce.number().int().min(0).max(1e10).optional(),
  count: z.coerce.number().int().min(1).max(5).default(3),
});

export const createLookSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  occasion: z.string().trim().max(40).optional(),
  // Thumbnail — 3D sahnadan olingan snapshot, ilova tayyorlaydi
  thumbnailUrl: z.string().url().max(500).optional(),
  isPublic: z.boolean().default(false),
  // Bir slotda bitta mahsulot (02-database: UNIQUE (look_id, slot))
  items: z
    .array(lookItemSchema)
    .min(1, 'Kamida bitta mahsulot kerak')
    .max(9)
    .refine(
      (items) => new Set(items.map((item) => item.slot)).size === items.length,
      'Bir slotda faqat bitta mahsulot bo`ladi',
    ),
});

export const favoriteQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: cursorSchema.optional(),
});

// ── AI kiyintirish ──

/**
 * Bitta kiyimni kiyintirishni so'rash.
 *
 * ⚠️ `baseRenderId` — QATLAM. Berilmasa kiyim foydalanuvchining ASL
 * suratiga kiydiriladi. Berilsa esa o'sha tayyor natijaning ustiga:
 * futbolka kiyingan surat ustiga kurtka. Ketma-ketlik shunday yig'iladi
 * (shim → futbolka → ko'ylak → xudi → kurtka).
 *
 * Server uchun bu shunchaki «model surati boshqa manzildan olinadi»
 * degani, ya'ni kesh mexanizmi o'zgarishsiz ishlaydi: `source_hash` ga
 * o'sha manzil kiradi va har qatlam kombinatsiyasi alohida keshlanadi.
 */
export const renderRequestSchema = z.object({
  variantId: z.string().uuid(),
  /** Ko'rish burchagi — har biri alohida natija va alohida to'lov */
  angle: z.enum(['front', 'side', 'back']).default('front'),
  baseRenderId: z.string().uuid().nullish(),
});

/**
 * Bir so'rovda ko'p kiyimni navbatga qo'yish.
 *
 * ⚠️ NEGA KERAK. Ilova tasmadagi HAMMA kiyimni oldindan kiyintiradi —
 * foydalanuvchi svayp qilganda kutib turmasin. Har biri uchun alohida
 * `POST` yuborilsa 30 ta parallel so'rov ketardi va ularning yarmi
 * kunlik chegaraga urilib xato qaytarardi.
 *
 * Bu yerda esa server o'zi navbatga qo'yadi va chegaraga yetganda
 * QOLGANINI TASHLAB YUBORADI — xato emas, `limitReached` belgisi bilan.
 */
export const renderBatchSchema = z.object({
  variantIds: z.array(z.string().uuid()).min(1).max(30),
  angle: z.enum(['front', 'side', 'back']).default('front'),
  baseRenderId: z.string().uuid().nullish(),
});

/**
 * Gallereya uchun ko'p variantning holati.
 *
 * ⚠️ CHEGARA BOR: bir so'rovda 50 tagacha. Bu `IN` so'rovining o'lchamini
 * va javob hajmini ushlab turadi — ilova baribir svayp oynasidan ko'pini
 * bir vaqtda ko'rsatmaydi.
 *
 * ⚠️ `baseRenderId` FILTR SIFATIDA HAM KERAK. Bitta variantning bir
 * necha natijasi bo'lishi mumkin: asl suratga kiydirilgani va boshqa
 * kiyim ustiga kiydirilgani. Filtrsiz `DISTINCT ON` ulardan tasodifiy
 * bittasini qaytarardi — foydalanuvchi kurtkani futbolka ustida
 * kutayotganda yalang'och gavdadagisini ko'rardi.
 */
export const renderStatusQuerySchema = z.object({
  angle: z.enum(['front', 'side', 'back']).default('front'),
  baseRenderId: z.string().uuid().optional(),
  /*
   * ⚠️ `all` — QATLAM ZANJIRINI TIKLASH UCHUN. Ilova komplektni
   * yig'ayotganda har qatlamning asosi qaysi ekanini HALI BILMAYDI: u
   * pastdagi natijaning `id` siga bog'liq, o'sha esa shu so'rovdan
   * keladi. Tovuq-tuxum. `all` bilan barcha natijalar keladi va ilova
   * zanjirni o'zi tiklaydi (`src/ai/outfit.ts`).
   *
   * Tasma uchun esa `base` yetarli va u ARZONROQ: bir variantga bitta
   * qator.
   */
  scope: z.enum(['base', 'all']).default('base'),
  variantIds: z
    .string()
    .transform((value) => value.split(',').filter((id) => id.length > 0))
    .pipe(z.array(z.string().uuid()).max(50)),
});

/**
 * AI kiyintirish uchun kiyimlar ro'yxati.
 *
 * ⚠️ `storeId` VA `size` — OQIMNING MA'NOSI. Foydalanuvchi sehrgarda
 * do'kon tanlagan va o'lchovlarini kiritgan; ro'yxat shu ikkisiga
 * bo'ysunmasa, u kiyintirib bo'lgach «bu o'lchamda yo'q» yoki «bu boshqa
 * do'konda» degan javob olardi — ya'ni sarflangan kredit behuda ketardi.
 */
export const garmentQuerySchema = z.object({
  /*
   * ⚠️ FAQAT KIYIM SLOTLARI. Model oyoq kiyim, soat va sumka uchun
   * o'qitilmagan — ularni ro'yxatga qo'shsak, foydalanuvchi bosadi,
   * pul sarflanadi va natija yaroqsiz chiqadi.
   */
  /*
   * ⚠️ RO'YXAT `AI_TRYON_SLOTS` BILAN BIR XIL BO'LISHI SHART.
   *
   * Ilgari bu yerda uchta slot qotirib yozilgan edi. `feet` qo'shilganda
   * ro'yxatlar ayri tushib qoldi: server uni qabul qilardi, sxema esa
   * «Invalid enum value» bilan rad etardi — oyoq kiyim tabi umuman
   * ochilmasdi.
   */
  slot: z.enum(['top', 'outer', 'bottom', 'feet']).optional(),
  /*
   * Uslub filtri — `products.tags` bilan kesishma bo'yicha.
   * Ro'yxat `GARMENT_STYLES` dan, ya'ni sotuvchi tanlagani bilan aynan bir xil.
   */
  style: z.enum(GARMENT_STYLES).optional(),
  /*
   * Kategoriya — slotdan ANIQROQ filtr. Futbolka, xudi va ko'ylak
   * uchalasi `top` slotida, lekin foydalanuvchi uchun uch xil narsa.
   */
  category: z.string().trim().min(1).max(64).optional(),
  gender: z.enum(['male', 'female', 'unisex']).optional(),
  storeId: uuidSchema.optional(),
  /** Faqat shu o'lcham omborda bo'lganlari (`S`, `M`, `42` …) */
  size: z.string().trim().min(1).max(16).optional(),
  /*
   * ⚠️ AYNAN SHU VARIANTLARNI QAYTARADI (2026-11-04).
   *
   * Mijoz turli do'konlardan "Look" bosib yig'adi — natija bir necha
   * do'kondagi variant ID'laridan iborat bo'ladi. Primerka ekraniga
   * ularni bitta so'rov bilan tortib olish kerak, aks holda do'kon
   * filtri (`storeId`) bilan har biri alohida so'rov ketardi va
   * boshqa do'kondagi kiyim umuman ko'rinmasdi.
   *
   * Berilganda boshqa filtrlar e'tiborga olinmaydi — ID ro'yxati
   * eng aniq filtr: aynan shu variantlar qaytadi.
   */
  variantIds: z
    .string()
    .trim()
    .transform((value) => value.split(',').filter(Boolean))
    .pipe(z.array(z.string().uuid()).min(1).max(20))
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

/** AI kiyintirish uchun mos do'konlar — pastdagi «boshqa do'kon» ro'yxati. */
export const tryonStoresQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  gender: z.enum(['male', 'female', 'unisex']).optional(),
  size: z.string().trim().min(1).max(16).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * To'liq bo'yli surat manzili.
 *
 * ⚠️ Manzil FAQAT o'z CDN'imizdan bo'lishi kerak — tekshiruv marshrutda.
 * Aks holda chetdagi manzil berilib, AI provayderiga bizning nomimizdan
 * begona rasm yuborilardi.
 */
export const bodyPhotoSchema = z.object({
  url: z.string().url().max(500),
});

export type TryonSlotQuery = z.output<typeof tryonSlotQuerySchema>;
export type CreateLookInput = z.output<typeof createLookSchema>;
export type SuggestLookInput = z.output<typeof suggestLookSchema>;
export type TryonEventInput = z.output<typeof tryonEventSchema>;
export type RenderRequestInput = z.output<typeof renderRequestSchema>;
export type RenderBatchInput = z.output<typeof renderBatchSchema>;
export type GarmentQuery = z.output<typeof garmentQuerySchema>;
export type TryonStoresQuery = z.output<typeof tryonStoresQuerySchema>;
export type BodyPhotoInput = z.output<typeof bodyPhotoSchema>;
