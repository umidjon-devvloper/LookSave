import { z } from 'zod';

import { personNameSchema } from './common';
import { e164PhoneSchema, validateE164Phone } from './phone';

/**
 * Parol qoidalari.
 *
 * Minimal 8 belgi — bu Faza 1 uchun yetarli chegara. Murakkablik talabi
 * (katta harf, raqam, belgi) atayin qo'yilmagan: foydalanuvchi shunchaki
 * "Parol123!" yozadi va bu kuchliroq qilmaydi. Uzunlik muhimroq.
 *
 * 128 belgi cheklovi — DoS oldini olish (uzun parolni hash qilish qimmat).
 */
export const passwordSchema = z
  .string()
  .min(8, 'Parol kamida 8 belgi bo`lishi kerak')
  .max(128, 'Parol juda uzun');

export const deviceSchema = z.object({
  deviceId: z.string().min(8).max(128).optional(),
  platform: z.enum(['ios', 'android', 'web']).optional(),
});

/**
 * Ro'yxatdan o'tish. Telefon E.164 formatida keladi va haqiqiy mobil
 * raqam ekanligi tekshiriladi (01-arxitektura, 1-qatlam).
 */
export const registerSchema = deviceSchema.extend({
  phone: e164PhoneSchema.superRefine((value, ctx) => {
    const result = validateE164Phone(value);
    if (!result.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        params: { fieldCode: result.code },
        message:
          result.code === 'NOT_MOBILE'
            ? 'Faqat mobil raqam qabul qilinadi'
            : 'Telefon raqami noto`g`ri',
      });
    }
  }),
  fullName: personNameSchema,
  password: passwordSchema,
  locale: z.enum(['uz', 'ru', 'en', 'ar']).optional(),
});

export const loginSchema = deviceSchema.extend({
  phone: e164PhoneSchema,
  password: z.string().min(1, 'Parol kiritilmagan').max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(2048),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

/**
 * Akkauntni o'chirish (03-api-spec §5).
 *
 * Parol majburiy: bu qaytarib bo'lmaydigan amal. `confirm` maydoni
 * ataylab qo'yilgan — ilova foydalanuvchidan aniq matn yozdiradi,
 * shunda tugma tasodifan bosilmaydi.
 */
export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
  confirm: z.literal('DELETE'),
});

export type DeleteAccountInput = z.output<typeof deleteAccountSchema>;

export type RegisterInput = z.output<typeof registerSchema>;
export type LoginInput = z.output<typeof loginSchema>;
export type RefreshInput = z.output<typeof refreshSchema>;
export type ChangePasswordInput = z.output<typeof changePasswordSchema>;

/**
 * Qurilmani ro'yxatga olish va push tokenini saqlash (05-mobile §9).
 * Expo tokeni `ExponentPushToken[...]` yoki FCM/APNs ko'rinishida bo'ladi.
 */
export const deviceRegisterSchema = z.object({
  deviceId: z.string().trim().min(8).max(128),
  platform: z.enum(['ios', 'android', 'web']),
  pushToken: z.string().trim().min(10).max(255).nullable().optional(),
  appVersion: z.string().trim().max(20).optional(),
});

export type DeviceRegisterInput = z.output<typeof deviceRegisterSchema>;

/** Profilni tahrirlash (03-api-spec §6). */
export const updateProfileSchema = z
  .object({
    fullName: personNameSchema.optional(),
    gender: z.enum(['male', 'female']).optional(),
    locale: z.enum(['uz', 'ru', 'en', 'ar']).optional(),
    /** Profil surati. `null` — suratni olib tashlash. */
    avatarUrl: z.string().url('Havola noto`g`ri').max(500).nullable().optional(),
    /**
     * Yuz skanerida olingan surat — 3D avatarning boshiga tekstura bo'lib
     * tushadi. `null` — olib tashlash (avatar neytral yuzga qaytadi).
     */
    faceTextureUrl: z.string().url('Havola noto`g`ri').max(500).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'O`zgartirish uchun maydon yo`q' });

/**
 * O'lchamlar. Chegaralar 03-api-spec §6 dan:
 * bo'y 120–220 sm · vazn 30–200 kg · oyoq 30–50 (EU).
 * Aylana o'lchamlari hujjatda ko'rsatilmagan — real diapazon olindi.
 */
export const measurementsSchema = z
  .object({
    height: z.number().int().min(120).max(220).optional(),
    weight: z.number().int().min(30).max(200).optional(),
    chest: z.number().int().min(50).max(180).optional(),
    waist: z.number().int().min(40).max(180).optional(),
    hips: z.number().int().min(50).max(180).optional(),
    shoeSize: z.number().min(30).max(50).optional(),
    shoeSizeSystem: z.enum(['EU', 'US', 'UK']).default('EU'),
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'shoeSizeSystem'),
    'Kamida bitta o`lcham kerak',
  );

export type UpdateProfileInput = z.output<typeof updateProfileSchema>;
export type MeasurementsInput = z.output<typeof measurementsSchema>;
