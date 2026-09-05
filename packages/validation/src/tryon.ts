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
export const AI_TRYON_SLOTS: readonly Slot[] = ['top', 'outer', 'bottom'];

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

/** Bitta kiyimni kiyintirishni so'rash. */
export const renderRequestSchema = z.object({
  variantId: z.string().uuid(),
  /** Ko'rish burchagi — har biri alohida natija va alohida to'lov */
  angle: z.enum(['front', 'side', 'back']).default('front'),
});

/**
 * Gallereya uchun ko'p variantning holati.
 *
 * ⚠️ CHEGARA BOR: bir so'rovda 50 tagacha. Bu `IN` so'rovining o'lchamini
 * va javob hajmini ushlab turadi — ilova baribir svayp oynasidan ko'pini
 * bir vaqtda ko'rsatmaydi.
 */
export const renderStatusQuerySchema = z.object({
  angle: z.enum(['front', 'side', 'back']).default('front'),
  variantIds: z
    .string()
    .transform((value) => value.split(',').filter((id) => id.length > 0))
    .pipe(z.array(z.string().uuid()).max(50)),
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
export type BodyPhotoInput = z.output<typeof bodyPhotoSchema>;
