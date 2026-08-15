import { z } from 'zod';

import { cursorSchema, moneyAmountSchema, uuidSchema } from './common';

/** Rang nomi — kamida bitta tilda (07-web-panels: mahsulot formasi). */
export const localizedNameSchema = z
  .object({
    uz: z.string().trim().min(1).max(60).optional(),
    ru: z.string().trim().min(1).max(60).optional(),
    en: z.string().trim().min(1).max(60).optional(),
    ar: z.string().trim().min(1).max(60).optional(),
  })
  .refine((value) => Object.values(value).some((name) => name !== undefined), {
    message: 'Kamida bitta tilda nom kerak',
  });

export const imageUrlSchema = z.string().url().max(500);

export const sizeStockSchema = z.object({
  size: z.string().trim().min(1).max(10),
  stock: z.number().int().min(0).max(100_000),
});

export const variantInputSchema = z.object({
  colorHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Rang formati: #1a1a1a')
    .optional(),
  colorName: localizedNameSchema.optional(),
  images: z.array(imageUrlSchema).max(10).default([]),
  priceDelta: moneyAmountSchema.default('0.00'),
  sizes: z.array(sizeStockSchema).min(1).max(30),
});

/**
 * `status` faqat `draft` yoki `pending` bo'lishi mumkin.
 * `active` ga o'tkazish — admin moderatsiyasi orqali (07-web-panels §5.1),
 * do'kon o'zi mahsulotni nashr qila olmaydi.
 */
export const productStatusSchema = z.enum(['draft', 'pending']);

export const createProductSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(2000).optional(),
    categoryId: uuidSchema,
    brandId: uuidSchema.optional(),
    gender: z.enum(['male', 'female', 'unisex']),
    basePrice: moneyAmountSchema,
    oldPrice: moneyAmountSchema.optional(),
    images: z.array(imageUrlSchema).max(10).default([]),
    tags: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
    isLimited: z.boolean().default(false),
    status: productStatusSchema.default('draft'),
    variants: z.array(variantInputSchema).min(1).max(20),
    request3d: z.boolean().default(false),
  })
  .refine(
    (value) => value.oldPrice === undefined || Number(value.oldPrice) > Number(value.basePrice),
    {
      path: ['oldPrice'],
      message: 'Eski narx joriy narxdan katta bo`lishi kerak',
    },
  )
  // Moderatsiyaga yuborishda kamida 3 rasm (07-web-panels: mahsulot formasi)
  .refine((value) => value.status === 'draft' || value.images.length >= 3, {
    path: ['images'],
    message: 'Nashr qilish uchun kamida 3 ta rasm kerak',
  });

export const updateProductSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    categoryId: uuidSchema.optional(),
    brandId: uuidSchema.nullable().optional(),
    gender: z.enum(['male', 'female', 'unisex']).optional(),
    basePrice: moneyAmountSchema.optional(),
    oldPrice: moneyAmountSchema.nullable().optional(),
    images: z.array(imageUrlSchema).max(10).optional(),
    tags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
    isLimited: z.boolean().optional(),
    status: productStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'O`zgartirish uchun maydon yo`q' });

export const stockUpdateSchema = z.object({
  sizes: z.array(sizeStockSchema).min(1).max(30),
});

export const storeProductsQuerySchema = z.object({
  status: z.enum(['draft', 'pending', 'active', 'archived', 'rejected', 'all']).default('all'),
  category: z.string().min(1).max(64).optional(),
  q: z.string().trim().min(2).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: cursorSchema.optional(),
});

/** Rasm yuklash uchun imzolangan havola (09-integrations §4.2). */
export const presignSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  contentType: z.enum(['image/webp', 'image/jpeg', 'image/png']),
  purpose: z.enum(['product', 'store', 'face', 'avatar']),
});

export type CreateProductInput = z.output<typeof createProductSchema>;
export type UpdateProductInput = z.output<typeof updateProductSchema>;
export type VariantInput = z.output<typeof variantInputSchema>;
export type StoreProductsQuery = z.output<typeof storeProductsQuerySchema>;
export type PresignInput = z.output<typeof presignSchema>;
