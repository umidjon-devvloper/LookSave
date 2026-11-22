import { pool } from '../db/pool';
import { logger } from '../logger';
import {
  generateStylistPlan,
  isTextAiEnabled,
  type StylistPick,
  type StylistPlan,
} from '../integrations/openai-text';

/**
 * AI stilist komplektini yig'adi.
 *
 * ⚠️ IKKI BOSQICH, HAR BIRI YIQILSA IKKINCHISI QOPLAYDI:
 *
 *   1) GPT (`openai-text.ts`) — foydalanuvchi so'rovidan niyat va slot
 *      ro'yxatini ajratib oladi. OpenAI kaliti yo'q bo'lsa yoki chaqiruv
 *      yiqilsa, qoida-asosli fallback ishga tushadi (`planFromRules`).
 *
 *   2) DB (`findProductForPick`) — har slot uchun bitta `active` mahsulot
 *      oladi, iloji boricha turli do'konlardan. Bo'sh qaytsa o'sha slot
 *      tashlanadi — bo'sh ekranga tushish yo'q.
 *
 * ⚠️ `search` BOR BO'LSA avval shuni ustun ko'radi, so'ng oddiy slot
 * qidiruviga tushadi. Qidiruv `pg_trgm` orqali (title va tags), shuning
 * uchun «ko'ylak» va «koylak» ikkisi ham mos keladi.
 *
 * ⚠️ DO'KON XILMA-XILLIGI — ATAYLAB. Bitta do'kondan komplekt yig'ib
 * berish katalogni «do'kon vitrinasi» ga aylantiradi; stilist bu emas.
 * Shuning uchun olingan har mahsulotning store_id si eslanadi va keyingi
 * tanlovda shu do'kon birinchi navbatda chetga suriladi.
 */

export interface OutfitItem {
  id: string;
  title: string;
  price: string;
  currency: string;
  image: string | null;
  slot: string;
  storeId: string;
  storeName: string;
}

export interface OutfitResult {
  answer: string;
  products: OutfitItem[];
}

export async function buildOutfit(prompt: string): Promise<OutfitResult> {
  const plan = await planFor(prompt);
  if (plan.picks.length === 0) {
    return { answer: plan.answer, products: [] };
  }

  const products: OutfitItem[] = [];
  const usedStores = new Set<string>();
  const seenProducts = new Set<string>();

  for (const pick of plan.picks) {
    const item = await findProductForPick(pick, usedStores, seenProducts);
    if (!item) continue;
    products.push(item);
    usedStores.add(item.storeId);
    seenProducts.add(item.id);
  }

  return { answer: plan.answer, products };
}

async function planFor(prompt: string): Promise<StylistPlan> {
  if (isTextAiEnabled()) {
    try {
      return await generateStylistPlan(prompt);
    } catch (err) {
      logger.warn({ err }, 'stylist: GPT yiqildi, qoidaga tushamiz');
    }
  }
  return planFromRules(prompt);
}

/**
 * GPT yo'q bo'lgandagi qoida — oddiy kalit so'z moslash.
 *
 * ⚠️ Rejadan, oldingi fallback kabi, ADABOTDA TA'SIR QOLMASIN DEB,
 * foydalanuvchi so'rovi maqsadni aniq aytmagan hol uchun keng standart
 * komplekt tanlanadi: ko'ylak + shim + tufli. Buni stilist ko'rinishi
 * saqlanadi — bo'sh joy yo'q.
 */
export function planFromRules(prompt: string): StylistPlan {
  const normalized = prompt.toLowerCase();

  const rules: Array<{ keys: string[]; answer: string; picks: StylistPick[] }> = [
    {
      keys: ["to'y", "to`y", 'toy', 'wedding', 'свадьб'],
      answer: "To'y uchun klassik komplekt taqdim etaman.",
      picks: [
        { slot: 'top', search: "ko'ylak" },
        { slot: 'bottom', search: 'shim' },
        { slot: 'feet', search: 'tufli' },
        { slot: 'outer', search: 'kostyum' },
      ],
    },
    {
      keys: ['ish', 'ofis', 'office', 'work', 'работ'],
      answer: 'Ish uchun rasmiy komplekt tavsiyam:',
      picks: [
        { slot: 'top', search: "ko'ylak" },
        { slot: 'bottom', search: 'shim' },
        { slot: 'feet', search: 'tufli' },
      ],
    },
    {
      keys: ['sport', 'спорт', 'gym', 'yugur', 'fitnes'],
      answer: 'Sport uchun qulay komplekt:',
      picks: [
        { slot: 'top', search: 'futbolka' },
        { slot: 'bottom', search: 'sport' },
        { slot: 'feet', search: 'krasovka' },
      ],
    },
    {
      keys: ['sayohat', 'travel', 'путеш'],
      answer: 'Sayohatga qulay va amaliy komplekt:',
      picks: [
        { slot: 'top', search: 'futbolka' },
        { slot: 'bottom', search: 'jinsa' },
        { slot: 'outer', search: 'kurtka' },
        { slot: 'feet', search: 'krasovka' },
      ],
    },
    {
      keys: ['uchrashuv', 'date', 'свида'],
      answer: 'Uchrashuv uchun chiroyli va nafis komplekt:',
      picks: [
        { slot: 'top', search: "ko'ylak" },
        { slot: 'bottom', search: 'shim' },
        { slot: 'feet', search: 'tufli' },
      ],
    },
    {
      keys: ['bayram', 'party', 'празд'],
      answer: 'Bayram uchun elegant komplekt:',
      picks: [
        { slot: 'top', search: "ko'ylak" },
        { slot: 'bottom', search: 'shim' },
        { slot: 'outer', search: 'pidjak' },
        { slot: 'feet', search: 'tufli' },
      ],
    },
    {
      keys: ["uyg'oq", 'uygoq', 'casual', 'kundalik', 'повседнев'],
      answer: 'Kundalik qulay komplekt:',
      picks: [
        { slot: 'top', search: 'futbolka' },
        { slot: 'bottom', search: 'jinsa' },
        { slot: 'feet', search: 'krasovka' },
      ],
    },
  ];

  for (const rule of rules) {
    if (rule.keys.some((k) => normalized.includes(k))) {
      return { answer: rule.answer, picks: rule.picks };
    }
  }

  return {
    answer: `«${prompt.slice(0, 40)}» bo'yicha umumiy komplekt tavsiyam:`,
    picks: [
      { slot: 'top' },
      { slot: 'bottom' },
      { slot: 'feet' },
    ],
  };
}

interface ProductRow {
  id: string;
  title: string;
  base_price: string;
  currency: string;
  images: unknown;
  slot: string;
  store_id: string;
  store_name: string;
}

async function findProductForPick(
  pick: StylistPick,
  usedStores: Set<string>,
  seenProducts: Set<string>,
): Promise<OutfitItem | null> {
  const params: unknown[] = [pick.slot];
  const where: string[] = [`p.status = 'active'`, `s.status = 'active'`, `p.slot = $1`];

  if (pick.search && pick.search.length >= 2) {
    params.push(`%${pick.search}%`);
    const si = params.length;
    where.push(
      `(p.title ILIKE $${si} OR EXISTS (
         SELECT 1 FROM unnest(p.tags) t WHERE t ILIKE $${si}
       ))`,
    );
  }

  if (seenProducts.size > 0) {
    params.push(Array.from(seenProducts));
    where.push(`p.id <> ALL($${params.length}::uuid[])`);
  }

  /*
   * ⚠️ IKKI BOSQICHLI SARALASH:
   *   - store_bias: ishlatilgan do'konni pastga suradi (0 yoki 1)
   *   - keyin tryon_count — mashhurroq mahsulot oldinroq
   *   - RANDOM — bir xil narsa qaytmasin
   *
   * `usedStores` bo'sh bo'lsa `store_bias` qisman olib tashlanadi (dastlabki
   * mahsulotga tryon_count birinchi o'rinda qoladi).
   */
  const storeBias =
    usedStores.size > 0
      ? `(CASE WHEN p.store_id = ANY($${params.length + 1}::uuid[]) THEN 1 ELSE 0 END)`
      : '0';
  if (usedStores.size > 0) params.push(Array.from(usedStores));

  const sql = `
    SELECT p.id, p.title, p.base_price, p.currency, p.images, p.slot,
           s.id AS store_id, s.name AS store_name
      FROM products p
      JOIN stores s ON s.id = p.store_id
     WHERE ${where.join(' AND ')}
     ORDER BY ${storeBias} ASC, p.tryon_count DESC, RANDOM()
     LIMIT 1
  `;

  const { rows } = await pool.query<ProductRow>(sql, params);
  const row = rows[0];
  if (!row) return null;

  const images = Array.isArray(row.images) ? (row.images as unknown[]) : [];
  const firstImage = typeof images[0] === 'string' ? (images[0] as string) : null;

  return {
    id: row.id,
    title: row.title,
    price: row.base_price,
    currency: row.currency,
    image: firstImage,
    slot: row.slot,
    storeId: row.store_id,
    storeName: row.store_name,
  };
}
