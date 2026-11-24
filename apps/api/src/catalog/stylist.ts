import { pool } from '../db/pool';
import { logger } from '../logger';
import {
  chooseFromCatalog,
  isTextAiEnabled,
  type StylistPick,
  type StylistPlan,
} from '../integrations/openai-text';

/**
 * AI stilist komplektini yig'adi — FAQAT DB'dagi haqiqiy mahsulotlardan.
 *
 * ⚠️ OQIM (2026-11-24 dan):
 *   1) `loadCatalog` — faol do'konlardagi faol, rasmi bor mahsulotlar (har
 *      slotdan ko'pi bilan `PER_SLOT` ta; «№23», «№24» kabi faqat raqami
 *      farq qiladigan nomlardan bittasi qoladi).
 *   2) AI (`chooseFromCatalog`: OpenAI, u yiqilsa Gemini) shu ro'yxatdan RAQAM bilan tanlaydi —
 *      uydirma mahsulot bo'lmaydi, javob matni ham tanlanganini aytadi.
 *   3) GPT yo'q / yiqildi / yaroqsiz raqam qaytardi → `pickByRules`: qoida
 *      slot + so'z bilan moslaydi, topilmasa mavjud slotlardan to'ldiradi.
 *
 * Nega: ilgari GPT qidiruv SO'ZI qaytarardi va SQL ILIKE bilan izlanardi.
 * Jonli katalogda (krossovka, sumka, kepka) «ko'ylak»/«shim» yo'q edi —
 * stilist «taklif qilaman» deb, bitta ham mahsulot ko'rsatmasdi (egasi
 * 2026-11-24 da: «bazamda qidirib rasmi bilan taklif qilishi kerak»).
 *
 * ⚠️ DO'KON XILMA-XILLIGI — ATAYLAB. Bitta do'kondan komplekt yig'ib berish
 * katalogni «do'kon vitrinasi» ga aylantiradi. Fallback'da ishlatilgan do'kon
 * keyingi tanlovda chetga suriladi; GPT esa slot xilma-xilligini o'zi ko'radi.
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

/** Har slotdan GPT'ga ko'rsatiladigan eng ko'p mahsulot. */
const PER_SLOT = 30;
/** Ro'yxatning umumiy chegarasi — token narxini tiyadi (~15 token/qator). */
const MAX_CATALOG = 150;
/** Bitta javobdagi eng ko'p mahsulot kartochkasi. */
const MAX_PICKS = 4;

export async function buildOutfit(prompt: string): Promise<OutfitResult> {
  const catalog = await loadCatalog();
  if (catalog.length === 0) {
    return {
      answer: "Hozircha katalogda tavsiya qiladigan mahsulot yo'q. Tez orada yangilari qo'shiladi.",
      products: [],
    };
  }

  if (isTextAiEnabled()) {
    try {
      const choice = await chooseFromCatalog(prompt, catalog.map(catalogLine));
      if (choice.picks.length === 0) {
        // Model ataylab tanlamadi (kiyimga aloqasiz savol) — faqat javob.
        return { answer: choice.answer, products: [] };
      }
      const products = resolvePicks(choice.picks, catalog);
      if (products.length > 0) return { answer: choice.answer, products };
      logger.warn({ picks: choice.picks }, 'stylist: AI raqamlari yaroqsiz, qoidaga tushamiz');
    } catch (err) {
      logger.warn({ err }, 'stylist: AI (OpenAI va Gemini) yiqildi, qoidaga tushamiz');
    }
  }

  const plan = planFromRules(prompt);
  return { answer: plan.answer, products: pickByRules(plan, catalog) };
}

/** GPT ro'yxatidagi bitta qator: `[feet] Krasovka Open Walk`. */
export function catalogLine(item: OutfitItem): string {
  return `[${item.slot}] ${item.title}`;
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

/**
 * GPT raqamlarini mahsulotga aylantiradi (raqam 1 dan boshlanadi).
 *
 * Avval har slotdan bittadan (ikki juft krossovka komplekt emas); natija
 * 2 tadan kam qolsa, tashlab ketilgan takroriy slotlar bilan to'ldiriladi.
 */
export function resolvePicks(picks: number[], catalog: OutfitItem[]): OutfitItem[] {
  const chosen = picks
    .map((n) => catalog[n - 1])
    .filter((item): item is OutfitItem => item !== undefined);

  const out: OutfitItem[] = [];
  const rest: OutfitItem[] = [];
  const slots = new Set<string>();
  for (const item of chosen) {
    if (out.some((o) => o.id === item.id)) continue;
    if (slots.has(item.slot)) {
      rest.push(item);
      continue;
    }
    slots.add(item.slot);
    out.push(item);
  }
  for (const item of rest) {
    if (out.length >= 2) break;
    out.push(item);
  }
  return out.slice(0, MAX_PICKS);
}

/**
 * Qoida rejasini katalogga moslaydi (GPT yo'q paytdagi yo'l).
 *
 * Har rejadagi slot uchun: sarlavhada qidiruv so'zi bor mahsulot, bo'lmasa
 * o'sha slotdagi istalgani; slot katalogda umuman yo'q bo'lsa tashlanadi.
 * So'ng natija 3 taga yetmasa — katalogdagi boshqa slotlardan to'ldiriladi,
 * shunda javob hech qachon bo'sh qolmaydi.
 */
export function pickByRules(plan: StylistPlan, catalog: OutfitItem[]): OutfitItem[] {
  const out: OutfitItem[] = [];
  const usedIds = new Set<string>();
  const usedStores = new Set<string>();
  const usedSlots = new Set<string>();

  const take = (candidates: OutfitItem[]): void => {
    const fresh = candidates.filter((c) => !usedIds.has(c.id) && !usedSlots.has(c.slot));
    const best = fresh.find((c) => !usedStores.has(c.storeId)) ?? fresh[0];
    if (!best) return;
    out.push(best);
    usedIds.add(best.id);
    usedStores.add(best.storeId);
    usedSlots.add(best.slot);
  };

  for (const pick of plan.picks) {
    if (out.length >= MAX_PICKS) break;
    const inSlot = catalog.filter((c) => c.slot === pick.slot);
    const term = pick.search?.toLowerCase();
    const matched = term ? inSlot.filter((c) => c.title.toLowerCase().includes(term)) : [];
    take(matched.length > 0 ? matched : inSlot);
  }

  const target = Math.min(3, MAX_PICKS);
  for (const item of catalog) {
    if (out.length >= target) break;
    take([item]);
  }
  return out;
}

interface CatalogRow {
  id: string;
  title: string;
  base_price: string;
  currency: string;
  images: unknown;
  slot: string;
  store_id: string;
  store_name: string;
}

/**
 * Stilist ko'ra oladigan mahsulotlar: faol do'kon, faol mahsulot, kamida
 * bitta rasm. Har slotdan `PER_SLOT` ta (mashhurlari oldin, qolgani
 * tasodifiy — har so'rovda bir xil narsa chiqmasin).
 *
 * ⚠️ `ORDER BY 0` YOZMA: Postgres butun son literalini ustun RAQAMI deb
 * o'qiydi va «ORDER BY position 0 is not in select list» bilan yiqiladi
 * (2026-11-24 prod'da har so'rov 500 bergan).
 */
async function loadCatalog(): Promise<OutfitItem[]> {
  const { rows } = await pool.query<CatalogRow>(
    `SELECT id, title, base_price, currency, images, slot, store_id, store_name
       FROM (
         SELECT p.id, p.title, p.base_price, p.currency, p.images, p.slot,
                s.id AS store_id, s.name AS store_name,
                row_number() OVER (
                  PARTITION BY p.slot ORDER BY p.tryon_count DESC, random()
                ) AS rn
           FROM products p
           JOIN stores s ON s.id = p.store_id
          WHERE p.status = 'active'
            AND s.status = 'active'
            AND jsonb_typeof(p.images) = 'array'
            AND jsonb_array_length(p.images) > 0
       ) t
      WHERE rn <= $1
      ORDER BY slot, rn
      LIMIT $2`,
    [PER_SLOT, MAX_CATALOG],
  );

  return dedupeTitles(
    rows
      .map((row) => ({
        id: row.id,
        title: row.title,
        price: row.base_price,
        currency: row.currency,
        image: firstImage(row.images),
        slot: row.slot,
        storeId: row.store_id,
        storeName: row.store_name,
      }))
      .filter((item) => item.image !== null),
  );
}

/**
 * «Barsetka №23», «Barsetka №24» — model uchun bir xil narsa. Faqat raqami
 * farq qiladigan nomlardan birinchisi qoladi: ro'yxat qisqaradi (token) va
 * model bir xil buyumni ikki marta tanlamaydi.
 */
export function dedupeTitles(items: OutfitItem[]): OutfitItem[] {
  const seen = new Set<string>();
  const out: OutfitItem[] = [];
  for (const item of items) {
    const key = `${item.slot}|${item.title
      .toLowerCase()
      .replace(/№\s*\d+/g, '')
      .replace(/\s+/g, ' ')
      .trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** `images` JSONB: satrlar massivi (`["https://…"]`) yoki `{url}` obyektlari. */
function firstImage(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  for (const img of images) {
    if (typeof img === 'string' && img) return img;
    if (img && typeof img === 'object') {
      const url = (img as Record<string, unknown>)['url'];
      if (typeof url === 'string' && url) return url;
    }
  }
  return null;
}
