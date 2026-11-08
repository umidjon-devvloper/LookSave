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

  /*
   * ── BFF xizmat kaliti (15-sayt-dizayn.md S-4) ──
   *
   * Sayt SSR bilan ishlaydi va API ga MEHMON emas, VEB-SERVER murojaat
   * qiladi. Bu kalit bilan tanishtirgan chaqiruvchi mehmon IP'sini
   * `X-LookSave-Client-Ip` da bera oladi va cheklov o'sha IP bo'yicha
   * hisoblanadi (`http/client-ip.ts`).
   *
   * ⚠️ SERVER-SERVER, brauzerga hech qachon berilmaydi — aks holda har
   * kim o'z cheklovini o'chirib qo'yardi. CORS ro'yxatiga ham
   * QO'SHILMAYDI (`app.ts`): brauzer bu sarlavhani yubora olmasin.
   *
   * Bo'sh bo'lsa imkoniyat o'chirilgan: hamma narsa eskicha `req.ip`
   * bo'yicha ishlaydi. Dev uchun qulay, prod'da to'ldiriladi.
   */
  INTERNAL_SERVICE_KEY: z
    .string()
    .default('')
    .refine((value) => value === '' || value.length >= 32, {
      message: 'kamida 32 belgi (`openssl rand -base64 32`)',
    }),

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
  STORE_PANEL_URL: z.string().url().default('https://store.looksave.uz'),

  // ── developer_ai paneli (operator navbati) ──
  /**
   * Qaysi AI ishlari operatorga ketadi: `avatar`, `render` yoki ikkalasi
   * (vergul bilan). Bo'sh — hammasi avvalgidek to'g'ridan-to'g'ri AI ga.
   *
   * ⚠️ SUKUT BO'SH. Bu o'zgaruvchi qo'yilmaguncha hech narsa o'zgarmaydi —
   * panel tayyor bo'lmasdan so'rovlar navbatga tushib, hech kim
   * ko'rmaydigan joyda qolib ketmasin.
   */
  DEVELOPER_AI_KINDS: z.string().default(''),
  /**
   * AI MAJBURAN avtomatik (OpenAI) ishlaydigan foydalanuvchilar — vergul
   * bilan ajratilgan user ID (UUID) ro'yxati. Operator rejimi (yuqoridagi)
   * yoniq bo'lsa ham, bu akkauntlar OpenAI orqali darhol natija oladi.
   *
   * Maqsad: App Store tekshiruvida DEMO akkaunt jonli natija ko'rsin, qolgan
   * mijozlar esa operatorda qolsin. Bo'sh — hech kimga istisno yo'q.
   */
  DEVELOPER_AI_AUTO_USERS: z.string().default(''),
  /** Yangi ish haqida xabar boradigan Telegram chat (operatorlar guruhi). */
  DEVELOPER_AI_TELEGRAM_CHAT_ID: z.string().default(''),
  DEVELOPER_AI_PANEL_URL: z.string().url().default('https://developer.looksave.uz'),

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
  /*
   * Shaxsiy suratlar uchun ALOHIDA bucket (12-tz.md D-43).
   *
   * ⚠️ NEGA `Cache-Control: private` YETMAYDI. `R2_BUCKET_ASSETS` ning
   * ommaviy `r2.dev` manzili bor va u kesh sarlavhasiga QARAMAYDI —
   * obyekt baribir kalitsiz o'qiladi. Ya'ni yuz surati ochiq turadi.
   *
   * Bo'sh bo'lsa hamma narsa eskicha ishlaydi (`R2_BUCKET_ASSETS`),
   * faqat ishga tushishda ogohlantirish chiqadi. To'ldirilgach `face/`
   * va `body/` shu bucketga boradi va o'qish imzolangan havola bilan
   * bo'ladi.
   */
  R2_BUCKET_PRIVATE: z.string().default(''),
  CDN_BASE_URL: z.string().url().default('https://cdn.looksave.uz'),

  // ── UploadThing (K-03: mahsulot va logo rasmlari uchun muqobil) ──
  /*
   * ⚠️ TOKEN BO'SH BO'LSA UPLOADTHING O'CHIRILGAN. Ilgari eshitadigan
   * yagona ombor R2 edi; token to'ldirilgach, yangi yuklamalar
   * UploadThing'ga ketadi, eski R2 havolalari esa o'qishga ochiq qoladi.
   * Shunday qilib migratsiya ikki tomonlama ishlaydi, mavjud rasmlarni
   * ko'chirish shart emas.
   *
   * Token uploadthing.com dashboard → "API Keys" dan olinadi, u yerda
   * token "sk_live_..." ko'rinishida ko'rsatiladi.
   */
  UPLOADTHING_TOKEN: z.string().default(''),

  // ── AI (OpenAI) ──
  /*
   * ⚠️ YAGONA AI PROVAYDER. Ilgari FASHN ham bor edi va ikkalasi
   * `TRYON_PROVIDER` bilan almashtirilardi; FASHN butunlay olib
   * tashlandi va tanlov ham qolmadi.
   *
   * Kalit bo'sh bo'lsa imkoniyat o'chirilgan deb hisoblanadi va ilova
   * buni ochiq aytadi — kalitsiz so'rov yuborib 401 kutib turish emas.
   *
   * ⚠️ MODEL BU YERDAN ALMASHADI. Sukut — `gpt-image-2.5-sunburst`:
   * OpenAI'ning tahrir aniqligiga yo'naltirilgan modeli. U kirish
   * rasmlarini HAR DOIM yuqori aniqlikda qayta ishlaydi, ya'ni yuz va
   * logo `gpt-image-1` dagidan sezilarli aniq saqlanadi — va chiqish
   * tokeni ham arzonroq ($30 va $40 / 1M).
   *
   * ⚠️ HAR MODEL O'Z PARAMETRINI OLADI. `input_fidelity` faqat
   * `gpt-image-1` va `1.5` da bor; 2.5 ga yuborilsa so'rov 400 bilan
   * qaytadi. Shuning uchun nomni bu yerda almashtirish YETARLI —
   * farqni `buildImageOptions` (`integrations/openai.ts`) yutadi.
   *
   * ⚠️ BILIB TURILGAN CHEKLOV QOLADI: bu baribir UMUMIY rasm modeli,
   * kiyim try-on uchun maxsus o'qitilmagan. Kiyimni nusxa ko'chirmaydi,
   * «shunga o'xshash» qilib chizadi — logo va naqsh o'zgarish ehtimoli
   * kamaydi, lekin nol emas (`integrations/openai.ts`).
   */
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  OPENAI_IMAGE_MODEL: z.string().default('gpt-image-2.5-sunburst'),

  /*
   * ⚠️ FACEFUSION — YUZ ALMASHTIRUVCHI POST-PROCESSOR.
   *
   * OpenAI chiqargan try-on rasmida yuz ba'zan foydalanuvchiga to'liq
   * o'xshamaydi (model o'z tasavvurini aralashtiradi). Shu bosqichda
   * facefusion xizmati orqali asl yuzimizni natijaga qo'shamiz.
   *
   * URL bo'sh bo'lsa — post-processing butunlay o'tkazib yuboriladi.
   * TOKEN ixtiyoriy (serverda sozlangan bo'lishi mumkin).
   */
  FACEFUSION_URL: z.string().default(''),
  FACEFUSION_TOKEN: z.string().default(''),
  FACEFUSION_MODEL: z.string().default('inswapper_128'),
  FACEFUSION_PIXEL_BOOST: z.string().default('512x512'),
  FACEFUSION_ENHANCE: z.coerce.boolean().default(true),
  /** Faqat front burchakka qo'llash — yon/orqa surati uchun yuz ko'rinmaydi. */
  FACEFUSION_FRONT_ONLY: z.coerce.boolean().default(true),
  /*
   * ⚠️ PYTHON CUTOUT XIZMATI (services/cutout-py/). Bo'sh bo'lsa — eski
   * `@imgly/background-removal-node` yo'li ishlatiladi (chekkada halo/jag
   * ko'proq). Tavsiya: `http://127.0.0.1:7801`.
   */
  CUTOUT_URL: z.string().default(''),

  /*
   * ⚠️ CHIQISH SIFATI — ENG KATTA SIFAT RICHAGI, VA U PUL TURADI.
   *
   * `gpt-image-2.5` da besh pog'ona bor: `low` < `medium` < `high` <
   * `xhigh` < `max`. Yuqoriroq pog'ona matoni, chokni, naqshni va yuzni
   * aniqroq chizadi — ya'ni aynan try-on sifatini ko'taradi — lekin har
   * chaqiruvda chiqish tokenini (demak dollarni) oshiradi.
   *
   * Sukut `high` da qoldirilgan: tajriba bilan hisob orasidagi muvozanat.
   * Prod'da `OPENAI_IMAGE_QUALITY=xhigh` qo'yib sifatni ko'tarib ko'rish
   * mumkin — REDEPLOY shart emas, chunki bu qiymat `buildImageOptions`
   * orqali `generationFingerprint` ichiga kiradi: o'zgarsa eski kesh
   * avtomatik mos kelmay qoladi va natijalar yangi sifatda qaytadan
   * yasaladi (`integrations/openai.ts`).
   *
   * ⚠️ `gpt-image-1` faqat `low|medium|high|auto` ni qabul qiladi —
   * unga `xhigh`/`max` yuborilsa 400. Enum ularni ataylab qoldiradi,
   * lekin modelga mosligini sozlovchi tekshirmaydi.
   */
  OPENAI_IMAGE_QUALITY: z
    .enum(['low', 'medium', 'high', 'xhigh', 'max', 'auto'])
    .default('high'),

  /*
   * ⚠️ KUNLIK CHEGARA — PUL HIMOYASI. Har bir yasalgan surat pul turadi,
   * kesh esa faqat TAKRORIY so'rovni to'sadi: foydalanuvchi har safar yangi
   * kiyimni so'rasa har biri alohida to'lanadi. Chegarasiz bitta hisob bir
   * kechada katalogni aylanib chiqib hisobni bo'shatishi mumkin.
   *
   * ⚠️ SUKUT 30 DAN 150 GA KO'TARILDI. Sabab: ilova endi tasmadagi HAMMA
   * kiyimni oldindan kiyintiradi (foydalanuvchi svayp qilganda kutmasin),
   * ya'ni bitta do'konni ochishning o'zi 30 tagacha surat degani. Eski
   * chegara bitta do'konga ham yetmasdi va oqim birinchi ekranda
   * to'xtardi.
   *
   * 150 — taxminan besh do'kon yoki bitta do'konning bir necha turkumi.
   * Bu SARF QARORI: pasaytirish tajribani buzadi, ko'tarish hisobni
   * oshiradi. Muhitdan (`TRYON_DAILY_LIMIT`) o'zgartiriladi.
   */
  TRYON_DAILY_LIMIT: z.coerce.number().int().min(1).max(500).default(150),
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
