import { listGarments } from './render';

/**
 * AI Designer — tadbir va uslubga qarab TO'LIQ komplekt yig'adi.
 *
 * ⚠️ BU LLM EMAS, QOIDA. Va bu ataylab qilingan tanlov, kamchilik emas.
 *
 * Deckda «AI builds complete looks» deyilgan va LLM chaqirish oson
 * bo'lardi. Lekin u har ochilishda PUL turadi, javobi har safar boshqacha
 * bo'ladi (foydalanuvchi orqaga qaytsa komplekt o'zgarib ketardi) va
 * katalogda o'nta mahsulot turganda tanlash uchun aql kerak emas.
 *
 * Qoida esa bepul, bir xil natija beradi va sinaladi. LLM ga o'tish
 * kerak bo'lganda almashtiriladigan joy bitta — `rankCandidates`.
 * Katalog kattalashib, tanlov haqiqatan qiyinlashganda o'sha yerdan
 * ulanadi.
 */

/** Komplekt qaysi slotlardan yig'iladi — deckdagi tartibda. */
const LOOK_SLOTS = ['top', 'outer', 'bottom', 'feet', 'wrist'] as const;

/**
 * Har tadbir uchun qaysi slotlar SHART.
 *
 * ⚠️ «Shart» degani — usiz komplekt taklif qilinmaydi. Ustki va pastki
 * kiyimsiz komplekt komplekt emas; kurtka esa sovuq havo yoki rasmiy
 * tadbirda kerak, sport uchun esa ortiqcha.
 */
const REQUIRED: Record<string, readonly string[]> = {
  Kundalik: ['top', 'bottom'],
  Ish: ['top', 'bottom'],
  Uchrashuv: ['top', 'bottom'],
  Bayram: ['top', 'bottom'],
  Sport: ['top', 'bottom'],
};

const DEFAULT_REQUIRED = ['top', 'bottom'] as const;

export interface SuggestInput {
  occasion: string;
  style: string;
  gender: string | null;
  /** Umumiy narx chegarasi — berilmasa cheklanmaydi */
  budget: number | null;
  /** Nechta variant qaytarilsin */
  count: number;
}

export interface LookItem {
  variantId: string;
  productId: string;
  title: string;
  slot: string;
  price: string;
  currency: string;
  image: string;
  colorHex: string | null;
  sizes: string[];
  store: { id: string; name: string };
}

export interface SuggestedLook {
  /** Barqaror kalit — ilovada ro'yxat uchun */
  key: string;
  items: LookItem[];
  total: string;
  currency: string;
}

/**
 * Nomzodlarni tartiblaydi.
 *
 * ⚠️ ALMASHTIRILADIGAN JOY. Hozir tartib oddiy: ko'p kiyib ko'rilgan
 * mahsulot oldinda (`listGarments` allaqachon shunday qaytaradi) va
 * byudjetga sig'adiganlar ustun. LLM kerak bo'lsa aynan shu funksiya
 * o'rniga qo'yiladi — qolgan mantiq o'zgarmaydi.
 */
function rankCandidates(items: LookItem[], perSlotBudget: number | null): LookItem[] {
  if (perSlotBudget === null) return items;

  return [...items].sort((a, b) => {
    const aFits = Number(a.price) <= perSlotBudget ? 0 : 1;
    const bFits = Number(b.price) <= perSlotBudget ? 0 : 1;
    return aFits - bFits;
  });
}

/** Pul NUMERIC — string bo'lib yuriladi, `Number` faqat solishtirish uchun. */
function sumPrices(items: LookItem[]): string {
  const total = items.reduce((sum, item) => sum + Number(item.price), 0);
  return total.toFixed(2);
}

/**
 * Nomzodlardan komplektlar yig'adi.
 *
 * ⚠️ ALOHIDA VA SOF FUNKSIYA — SINOV UCHUN. `suggestLooks` bazaga
 * murojaat qiladi va uni sinash uchun butun katalogni qo'yish kerak
 * bo'lardi. Qaror mantiqi esa shu yerda va u oddiy massivlar ustida
 * ishlaydi. Xuddi shu yo'l `nextSwipeIndex` va `faceQuality` da ham
 * ishlatilgan.
 */
export function composeLooks(garments: LookItem[], input: SuggestInput): SuggestedLook[] {
  const bySlot = new Map<string, LookItem[]>();
  for (const item of garments) {
    const list = bySlot.get(item.slot) ?? [];
    list.push(item);
    bySlot.set(item.slot, list);
  }

  const required = REQUIRED[input.occasion] ?? DEFAULT_REQUIRED;

  // Shart slotlardan birortasi bo'sh bo'lsa komplekt yig'ib bo'lmaydi
  for (const slot of required) {
    if (!bySlot.get(slot)?.length) return [];
  }

  /*
   * Har slot uchun byudjet ulushi. Aniq taqsimot emas — shunchaki
   * tartiblash uchun mo'ljal: beshta buyum bo'lsa har biriga beshdan bir.
   */
  const perSlotBudget = input.budget === null ? null : input.budget / LOOK_SLOTS.length;

  const ranked = new Map<string, LookItem[]>();
  for (const [slot, items] of bySlot) {
    ranked.set(slot, rankCandidates(items, perSlotBudget));
  }

  const looks: SuggestedLook[] = [];

  for (let index = 0; index < input.count; index += 1) {
    const items: LookItem[] = [];

    for (const slot of LOOK_SLOTS) {
      const candidates = ranked.get(slot);
      if (!candidates?.length) continue;

      /*
       * ⚠️ HAR KOMPLEKT BOSHQA NOMZODNI OLADI. Indeks bo'yicha
       * aylantiriladi — aks holda uchala taklif ham bir xil chiqardi va
       * «AI uchta variant yasadi» degan va'da yolg'on bo'lardi.
       */
      const pick = candidates[index % candidates.length];
      if (pick) items.push(pick);
    }

    // Shart slotlar to'liq bo'lmasa bu variant tashlanadi
    if (!required.every((slot) => items.some((item) => item.slot === slot))) continue;

    const total = sumPrices(items);

    /*
     * Byudjetdan oshgan komplekt ko'rsatilmaydi. Foydalanuvchi chegara
     * bergan bo'lsa, undan qimmatini taklif qilish uni hurmat qilmaslik.
     */
    if (input.budget !== null && Number(total) > input.budget) continue;

    looks.push({
      key: items.map((item) => item.variantId).join('-'),
      items,
      total,
      currency: items[0]?.currency ?? 'UZS',
    });
  }

  /*
   * Takrorlarni olib tashlaymiz: kichik katalogda aylantirish bir xil
   * to'plamga qaytishi mumkin.
   */
  const seen = new Set<string>();
  return looks.filter((look) => {
    if (seen.has(look.key)) return false;
    seen.add(look.key);
    return true;
  });
}

/**
 * Katalogdan nomzodlarni olib, komplektlarni yig'adi.
 *
 * ⚠️ BITTA SO'ROV, HAR SLOT UCHUN ALOHIDA EMAS. Beshta slot uchun
 * beshta so'rov yuborilsa katalog o'sganda sezilarli sekinlashardi —
 * `listGarments` slotlar massivini qabul qiladi.
 *
 * Chegara katta: har slotdan bir nechta nomzod kerak, aks holda hamma
 * komplekt bir xil chiqardi.
 */
export async function suggestLooks(input: SuggestInput): Promise<SuggestedLook[]> {
  const garments = await listGarments([...LOOK_SLOTS], input.gender, 60);
  return composeLooks(garments, input);
}
