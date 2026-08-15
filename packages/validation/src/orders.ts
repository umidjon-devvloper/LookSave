import { z } from 'zod';

import { cursorSchema, moneyAmountSchema, personNameSchema, uuidSchema } from './common';
import { e164PhoneSchema } from './phone';

/** O'lcham: "M", "42", "ONE" */
export const sizeSchema = z.string().trim().min(1).max(10);

export const cartItemSchema = z.object({
  variantId: uuidSchema,
  size: sizeSchema,
  qty: z.number().int().min(1).max(10).default(1),
});

export const cartItemUpdateSchema = z.object({
  qty: z.number().int().min(1).max(10),
});

/**
 * Yetkazib berish manzili (03-api-spec §17).
 * lat/lng MAJBURIY — kuryer manzilni matn bo'yicha topa olmaydi va
 * radius tekshiruvi ham koordinatasiz ishlamaydi.
 */
export const addressSchema = z.object({
  text: z.string().trim().min(10, 'Manzil juda qisqa').max(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  landmark: z.string().trim().max(200).optional(),
});

export const createOrderSchema = z
  .object({
    storeId: uuidSchema,
    deliveryType: z.enum(['delivery', 'pickup']),
    contactName: personNameSchema.max(80),
    contactPhone: e164PhoneSchema,
    address: addressSchema.optional(),
    note: z.string().trim().max(500).optional(),
    items: z.array(cartItemSchema).min(1).max(20),
  })
  .refine((value) => value.deliveryType === 'pickup' || value.address !== undefined, {
    path: ['address'],
    message: 'Yetkazib berish uchun manzil kerak',
  })
  .refine(
    (value) => {
      // Bir xil variant+o'lcham ikki marta kelmasin — aks holda
      // rezerv ikki marta hisoblanadi
      const keys = value.items.map((item) => `${item.variantId}:${item.size}`);
      return new Set(keys).size === keys.length;
    },
    { path: ['items'], message: 'Bir xil mahsulot ikki marta ko`rsatilgan' },
  );

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(3).max(300).optional(),
});

export const ordersQuerySchema = z.object({
  status: z.enum(['active', 'completed', 'cancelled', 'all']).default('active'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: cursorSchema.optional(),
});

export type CartItemInput = z.output<typeof cartItemSchema>;
export type CreateOrderInput = z.output<typeof createOrderSchema>;
export type OrdersQuery = z.output<typeof ordersQuerySchema>;
export type AddressInput = z.output<typeof addressSchema>;

// ── Do'kon paneli (03-api-spec §13) ──

export const storeOrdersQuerySchema = z.object({
  status: z.enum(['new', 'active', 'completed', 'cancelled', 'all']).default('new'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: cursorSchema.optional(),
});

export const rejectOrderSchema = z.object({
  reason: z.enum(['out_of_stock', 'size_unavailable', 'price_changed', 'fake_order', 'other']),
  comment: z.string().trim().max(300).optional(),
  blockPhone: z.boolean().default(false),
});

export const completeOrderSchema = z.object({
  paymentMethod: z.enum(['cash', 'card_offline', 'transfer']).default('cash'),
});

export const noShowSchema = z.object({
  blockPhone: z.boolean().default(false),
});

export const blocklistAddSchema = z.object({
  phone: e164PhoneSchema,
  reason: z.string().trim().min(3).max(300),
});

export type StoreOrdersQuery = z.output<typeof storeOrdersQuerySchema>;
export type RejectOrderInput = z.output<typeof rejectOrderSchema>;

/** Statistika davri (07-web-panels §4.6). */
export const analyticsQuerySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .refine((value) => [7, 30, 90].includes(value), '7, 30 yoki 90 kun')
    .default(30),
});

/** Admin buyurtmalar ro'yxati (03-api-spec §15). */
export const adminOrdersQuerySchema = z.object({
  status: z
    .enum([
      'new',
      'seen',
      'confirmed',
      'ready',
      'completed',
      'rejected',
      'cancelled',
      'expired',
      'all',
    ])
    .default('all'),
  storeId: uuidSchema.optional(),
  q: z.string().trim().min(3).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: cursorSchema.optional(),
});

export type AdminOrdersQuery = z.output<typeof adminOrdersQuerySchema>;

/** Do'kon jamoasi (07-web-panels §4.8). */
export const memberRoleSchema = z.enum(['owner', 'manager', 'staff']);

export const addMemberSchema = z.object({
  phone: e164PhoneSchema,
  role: memberRoleSchema.default('staff'),
});

export const updateMemberSchema = z.object({ role: memberRoleSchema });

// ── Do'kon sozlamalari (07-web-panels §4.8) ──

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Vaqt formati: 09:00');

/**
 * Ish vaqti. 1 = dushanba … 7 = yakshanba.
 * `close` `open` dan kichik bo'lsa — yarim tundan o'tadi (14:00–02:00).
 */
export const workingHourSchema = z.object({
  day: z.number().int().min(1).max(7),
  open: timeSchema,
  close: timeSchema,
  closed: z.boolean().default(false),
});

export const workingHoursSchema = z
  .array(workingHourSchema)
  .max(7)
  .refine(
    (hours) => new Set(hours.map((hour) => hour.day)).size === hours.length,
    'Bir kun ikki marta ko`rsatilgan',
  );

export const updateStoreSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    phone: e164PhoneSchema.optional(),
    logoUrl: z.string().url().max(500).nullable().optional(),
    coverUrl: z.string().url().max(500).nullable().optional(),
    address: z.string().trim().min(5).max(300).optional(),
    landmark: z.string().trim().max(200).nullable().optional(),
    location: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .optional(),
    workingHours: workingHoursSchema.optional(),
    deliveryEnabled: z.boolean().optional(),
    pickupEnabled: z.boolean().optional(),
    deliveryRadiusM: z.number().int().min(500).max(50_000).optional(),
    deliveryFee: moneyAmountSchema.optional(),
    freeDeliveryFrom: moneyAmountSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'O`zgartirish uchun maydon yo`q' })
  .refine((value) => value.deliveryEnabled !== false || value.pickupEnabled !== false, {
    path: ['pickupEnabled'],
    message: 'Kamida bitta usul yoqilgan bo`lishi kerak',
  });

/**
 * Do'kon arizasi.
 *
 * ⚠️ HUJJATDA YO'Q. 03-api-spec `pending` statusli do'konni admin
 * tasdiqlashini tasvirlaydi, lekin arizani kim yaratishini aytmaydi —
 * amalda do'konlar SQL bilan qo'lda qo'shilgan. Bu sxema shu bo'shliqni
 * to'ldiradi.
 *
 * `updateStoreSchema` dan farqi: bu yerda maydonlar MAJBURIY. Do'kon
 * manzilsiz yoki telefonsiz ro'yxatga tushsa, mijoz buyurtma bera olmaydi.
 */
export const storeApplicationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  phone: e164PhoneSchema,
  address: z.string().trim().min(5).max(300),
  landmark: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(100),
  country: z.enum(['UZ', 'AE']),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  currency: z.enum(['UZS', 'AED', 'USD']),
  workingHours: workingHoursSchema.optional(),
  deliveryEnabled: z.boolean().default(true),
  pickupEnabled: z.boolean().default(true),
});

export type StoreApplicationInput = z.output<typeof storeApplicationSchema>;

export type UpdateStoreInput = z.output<typeof updateStoreSchema>;
export type WorkingHour = z.output<typeof workingHourSchema>;
