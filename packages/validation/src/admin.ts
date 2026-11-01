import { z } from 'zod';

import { cursorSchema, uuidSchema } from './common';
import { localizedNameSchema } from './store-products';
import { slotSchema } from './tryon';

export const adminStoresQuerySchema = z.object({
  status: z.enum(['pending', 'active', 'suspended', 'rejected', 'all']).default('pending'),
  q: z.string().trim().min(2).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: cursorSchema.optional(),
});

/** LIMITED kolleksiya belgisi — admin tasdiqlaydi, sotuvchi emas. */
export const productLimitedSchema = z.object({
  isLimited: z.boolean(),
});

export const rejectReasonSchema = z.object({
  reason: z.string().trim().min(3, 'Sabab kamida 3 belgi').max(500),
});

export const adminProductsQuerySchema = z.object({
  status: z.enum(['pending', 'rejected', 'active']).default('pending'),
  storeId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: cursorSchema.optional(),
});

export const assetQueueQuerySchema = z.object({
  status: z.enum(['queued', 'processing', 'ready', 'failed', 'all']).default('queued'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * QA natijasi (04-3d-pipeline §6). `ready` ga o'tkazish uchun majburiy —
 * bitta sifatsiz model butun ilova tajribasini buzadi (07-web-panels §5.3).
 */
export const qaResultSchema = z.object({
  fpsHighEnd: z.number().int().min(1).max(240),
  fpsMidRange: z.number().int().min(1).max(240),
  fpsLowEnd: z.number().int().min(1).max(240),
  loadMs: z.number().int().min(1).max(60_000),
  ramMb: z.number().int().min(1).max(4096),
  checklistPassed: z.literal(true, {
    errorMap: () => ({ message: 'QA ro`yxati to`liq bajarilishi kerak' }),
  }),
});

export const assetUpdateSchema = z
  .object({
    status: z.enum(['queued', 'processing', 'ready', 'failed']),
    glbUrl: z.string().url().max(500).optional(),
    lodUrls: z.record(z.enum(['lod0', 'lod1', 'lod2']), z.string().url().max(500)).optional(),
    thumbnailUrl: z.string().url().max(500).optional(),
    fileSizeBytes: z.number().int().min(1).max(50_000_000).optional(),
    polyCount: z.number().int().min(1).max(1_000_000).optional(),
    textureSize: z.union([z.literal(512), z.literal(1024), z.literal(2048)]).optional(),
    hideBodyParts: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    hasMorphs: z.boolean().default(false),
    qaResult: qaResultSchema.optional(),
    errorMessage: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.status !== 'ready' || value.glbUrl !== undefined, {
    path: ['glbUrl'],
    message: 'Nashr qilish uchun GLB havolasi kerak',
  })
  .refine((value) => value.status !== 'ready' || value.qaResult !== undefined, {
    path: ['qaResult'],
    message: 'QA natijasisiz nashr qilib bo`lmaydi',
  })
  .refine((value) => value.status !== 'failed' || value.errorMessage !== undefined, {
    path: ['errorMessage'],
    message: 'Xato sababini yozing',
  });

export const adminUsersQuerySchema = z.object({
  restricted: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .default(false)
    .transform((value) => value === true || value === 'true'),
  q: z.string().trim().min(2).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * Brend — admin panelda boshqariladi (07-web-panels).
 * Slug berilmasa, server nomdan o'zi yasaydi.
 */
export const brandCreateSchema = z.object({
  name: z.string().trim().min(2, 'Nomi kamida 2 belgi').max(64),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, 'Faqat lotin harflari, raqam va chiziqcha')
    .min(2)
    .max(64)
    .optional(),
  logoUrl: z.string().url('Havola noto`g`ri').max(500).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  isPartner: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

/** Tahrirlashda hamma maydon ixtiyoriy, lekin kamida bittasi bo'lishi shart. */
export const brandUpdateSchema = brandCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Hech qanday o'zgarish yuborilmadi",
  });

/**
 * Kategoriya — admin panelda boshqariladi (qo'shish/tahrirlash/o'chirish).
 *
 * ⚠️ `name` KO'P TILLI (JSONB). `slug` berilmasa nomdan yasaladi. `slot`
 * kiyintirish uchun (aksessuarda `null` bo'lishi mumkin). `parentId` —
 * ichki kategoriya (masalan «Ustki kiyim» → «Futbolka»).
 */
export const categoryCreateSchema = z.object({
  name: localizedNameSchema,
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, 'Faqat lotin harflari, raqam va chiziqcha')
    .min(2)
    .max(64)
    .optional(),
  icon: z.string().trim().max(64).nullable().optional(),
  slot: slotSchema.nullable().optional(),
  gender: z.enum(['male', 'female', 'unisex']).default('unisex'),
  sizeType: z.enum(['clothing', 'shoes', 'onesize']).nullable().optional(),
  parentId: uuidSchema.nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

export const categoryUpdateSchema = categoryCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Hech qanday o'zgarish yuborilmadi",
  });

export type CategoryCreateInput = z.output<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.output<typeof categoryUpdateSchema>;

export type BrandCreateInput = z.output<typeof brandCreateSchema>;
export type BrandUpdateInput = z.output<typeof brandUpdateSchema>;

const bannerTargetSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) =>
      value.startsWith('/') ||
      value.startsWith('https://') ||
      value.startsWith('http://'),
    'Havola / bilan yoki http(s) bilan boshlanishi kerak',
  );

export const bannerCreateSchema = z.object({
  title: z.string().trim().min(2, 'Sarlavha kamida 2 belgi').max(100),
  subtitle: z.string().trim().max(180).nullable().optional(),
  imageUrl: z.string().url('Rasm havolasi noto`g`ri').max(500),
  targetUrl: bannerTargetSchema.nullable().optional(),
  audience: z.enum(['all', 'men', 'women', 'limited']).default('all'),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const bannerUpdateSchema = bannerCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Hech qanday o'zgarish yuborilmadi",
  });

export type BannerCreateInput = z.output<typeof bannerCreateSchema>;
export type BannerUpdateInput = z.output<typeof bannerUpdateSchema>;

export type AdminStoresQuery = z.output<typeof adminStoresQuerySchema>;
export type AdminProductsQuery = z.output<typeof adminProductsQuerySchema>;
export type AssetQueueQuery = z.output<typeof assetQueueQuerySchema>;
export type AssetUpdateInput = z.output<typeof assetUpdateSchema>;
export type AdminUsersQuery = z.output<typeof adminUsersQuerySchema>;
