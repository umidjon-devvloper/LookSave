import { z } from 'zod';

/**
 * Muhit o'zgaruvchilari ishga tushishda bir marta tekshiriladi.
 * Yetishmayotgan sir bo'lsa server KO'TARILMAYDI — yarim ishlaydigan
 * holatda turgandan ko'ra darhol yiqilgani yaxshi.
 *
 * Ro'yxat: infra/.env.example (docs/08-deployment.md §6)
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  // Access va refresh uchun ALOHIDA sir (docs/08-deployment.md §12).
  // 32 belgi — `openssl rand -base64 48` shundan uzunroq beradi.
  JWT_ACCESS_SECRET: z.string().min(32, 'kamida 32 belgi'),
  JWT_REFRESH_SECRET: z.string().min(32, 'kamida 32 belgi'),
  JWT_ACCESS_TTL: z
    .string()
    .regex(/^\d+[smhd]$/)
    .default('15m'),
  JWT_REFRESH_TTL: z
    .string()
    .regex(/^\d+[smhd]$/)
    .default('30d'),

  // Deploy qilingan versiya (git sha). Docker'da API_TAG orqali keladi.
  API_TAG: z.string().default('dev'),

  // Vergul bilan ajratilgan domenlar. Bo'sh bo'lsa — CORS umuman yopiq.
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),

  // So'rov tanasi chegarasi. Caddy'da ham 12MB (docs/08-deployment.md §5).
  BODY_LIMIT: z.string().default('12mb'),

  // ── Biznes qoidalari (infra/.env.example) ──
  ORDER_EXPIRY_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  MAX_OPEN_ORDERS: z.coerce.number().int().min(1).max(50).default(3),
  MAX_DAILY_ORDERS: z.coerce.number().int().min(1).max(100).default(5),
  /** Faza 1-2 da 0 (K-12). Hisoblanadi, lekin undirilmaydi. */
  DEFAULT_COMMISSION_RATE: z.coerce.number().min(0).max(0.5).default(0),

  // ── Telegram (K-13: sotuvchi uchun asosiy kanal) ──
  // Bo'sh bo'lsa bot o'chirilgan deb hisoblanadi — dev muhitida qulay.
  TELEGRAM_BOT_TOKEN: z.string().default(''),
  TELEGRAM_WEBHOOK_SECRET: z.string().default(''),
  TELEGRAM_BOT_USERNAME: z.string().default('LookSaveBot'),
  STORE_PANEL_URL: z.string().url().default('https://store.looksave.app'),

  // Expo Push. Bo'sh bo'lsa push o'chirilgan deb hisoblanadi.
  EXPO_ACCESS_TOKEN: z.string().default(''),

  // ── 3D avatar ──
  // Skelet versiyasi model havolalariga kiradi: yangilanganda ilovani
  // qayta chiqarish shart emas, faqat bu qiymat o'zgaradi
  AVATAR_SKELETON_VERSION: z.string().default('v1'),

  // ── Cloudflare R2 (K-03: egress bepul) ──
  R2_ACCESS_KEY_ID: z.string().default(''),
  R2_SECRET_ACCESS_KEY: z.string().default(''),
  R2_ENDPOINT: z.string().default(''),
  R2_BUCKET_ASSETS: z.string().default('looksave-assets'),
  CDN_BASE_URL: z.string().url().default('https://cdn.looksave.app'),
});

const withChecks = envSchema.superRefine((value, ctx) => {
  if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['JWT_REFRESH_SECRET'],
      message: 'access va refresh sirlari bir xil bo`lmasligi kerak',
    });
  }
});

export type Env = z.output<typeof withChecks>;

let cached: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = withChecks.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Muhit o'zgaruvchilari noto'g'ri:\n${details}`);
  }

  return parsed.data;
}

/** Ilova bo'ylab yagona nusxa. Testlarda `loadEnv(...)` to'g'ridan-to'g'ri chaqiriladi. */
export function env(): Env {
  cached ??= loadEnv();
  return cached;
}
