import { z } from 'zod';

import { cursorSchema, uuidSchema } from './common';

/** Query string'dan keladigan `"true"` / `"1"` ni boolean'ga o'giradi. */
const boolQuery = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .default(false)
  .transform((value) => value === true || value === 'true' || value === '1');

const latSchema = z.coerce.number().min(-90).max(90);
const lngSchema = z.coerce.number().min(-180).max(180);

/** GET /stores/nearby (03-api-spec §8) */
export const nearbyQuerySchema = z.object({
  lat: latSchema,
  lng: lngSchema,
  // 50 km dan kattasi butun shaharni qamrab oladi va so'rov qimmatlashadi
  radius: z.coerce.number().int().min(100).max(50_000).default(5_000),
  category: z.string().min(1).max(64).optional(),
  /**
   * ⚠️ ILGARI `only3d` EDI — «3D modeli bor mahsulotlar». 3D olib
   * tashlangandan keyin filtr o'z ma'nosini yo'qotdi: foydalanuvchi uni
   * «kiyib ko'rsa bo'ladiganlar» deb tushunardi, baza esa butunlay
   * boshqa ustunni tekshirardi.
   */
  onlyTryon: boolQuery,
  openNow: boolQuery,
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** GET /stores/map — xarita chegaralari */
export const storeMapQuerySchema = z
  .object({
    swLat: latSchema,
    swLng: lngSchema,
    neLat: latSchema,
    neLng: lngSchema,
    zoom: z.coerce.number().int().min(1).max(21).default(12),
  })
  .refine((value) => value.neLat > value.swLat, {
    path: ['neLat'],
    message: 'neLat swLat dan katta bo`lishi kerak',
  });

export const productSortSchema = z
  .enum(['newest', 'popular', 'priceAsc', 'priceDesc', 'nearest'])
  .default('newest');

/** GET /products va GET /stores/:id/products — bir xil filtrlar */
export const productsQuerySchema = z
  .object({
    category: z.string().min(1).max(64).optional(),
    gender: z.enum(['male', 'female', 'unisex']).optional(),
    brand: z.string().min(1).max(64).optional(),
    storeId: uuidSchema.optional(),
    priceMin: z.coerce.number().min(0).max(1e10).optional(),
    priceMax: z.coerce.number().min(0).max(1e10).optional(),
    onlyTryon: boolQuery,
    /** Deckning 07-slaydidagi LIMITED kolleksiyasi */
    limited: boolQuery,
    q: z.string().trim().min(2).max(64).optional(),
    sort: productSortSchema,
    lat: latSchema.optional(),
    lng: lngSchema.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: cursorSchema.optional(),
  })
  .refine(
    (value) =>
      value.priceMin === undefined ||
      value.priceMax === undefined ||
      value.priceMin <= value.priceMax,
    {
      path: ['priceMin'],
      message: 'priceMin priceMax dan katta bo`lmasligi kerak',
    },
  )
  .refine(
    (value) => value.sort !== 'nearest' || (value.lat !== undefined && value.lng !== undefined),
    {
      path: ['sort'],
      message: '`nearest` uchun lat va lng kerak',
    },
  );

export const idParamSchema = z.object({ id: uuidSchema });

/** Masofa hisoblash uchun ixtiyoriy nuqta (mahsulot sahifasi, do'kon kartochkasi). */
export const pointQuerySchema = z.object({
  lat: latSchema.optional(),
  lng: lngSchema.optional(),
});

export type NearbyQuery = z.output<typeof nearbyQuerySchema>;
export type StoreMapQuery = z.output<typeof storeMapQuerySchema>;
export type ProductsQuery = z.output<typeof productsQuerySchema>;
export type ProductSort = z.output<typeof productSortSchema>;
