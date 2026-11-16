import { supportsAiTryon } from '@looksave/validation';

/**
 * Look savati — foydalanuvchi «Look» bosib yig'gan kiyimlar va ularni
 * kiyib ko'rish urinishlari.
 *
 * ⚠️ NEGA QATLAM EMAS, ODDIY RO'YXAT. Ilgari yig'ilgan kiyimlar
 * `OutfitLayer` (turkum → kiyim) bo'lib saqlanardi va har biri ALOHIDA,
 * biri ikkinchisining ustiga kiyintirilardi: 3 ta kiyim = 3 ta operator
 * ishi, har biri bir necha daqiqa. Endi belgilangan kiyimlar bitta
 * so'rovda ketadi va bitta rasm qaytadi (`/tryon/render/bundle`), ya'ni
 * zanjir ham, asos ham, tartib ham kerak emas — faqat «nimalar yig'ilgan
 * va ulardan qaysilari hozir kiyiladi».
 *
 * ⚠️ BU MODULDA REACT NATIVE YO'Q — ATAYIN. Qoida («bir turdan bittasi»,
 * «mahsulot bir marta», chegaralar) ekranga tegmaydi va shuning uchun
 * sinaladi (`lookTray.test.ts`). Saqlash va ekran `store/lookStore.ts` da.
 */

/** Savat sig'imi. Qurilmadagi yozuv 2 KB dan oshmasligi uchun ham kerak. */
export const TRAY_LIMIT = 12;

/** Eslab qolinadigan urinishlar soni — eng yangilari. */
export const TRIES_LIMIT = 6;

export interface TrayItem {
  /** Mahsulot — bosh sahifa kartasi faqat shuni biladi */
  productId: string | null;
  /**
   * Variant (rang). Kiyintirish so'rovi AYNAN shunga ketadi.
   *
   * `null` — hali aniqlanmagan: karta mahsulotni biladi, rangini emas.
   * Primerka ekrani uni serverdan so'rab to'ldiradi.
   */
  variantId: string | null;
  /** Tana qismi: top · outer · bottom · feet. Noma'lum bo'lsa `null` */
  slot: string | null;
  /** Hozir kiyib ko'riladimi. O'chiq kiyim savatda qoladi — nomzod sifatida */
  on: boolean;
  /** Do'kondan olib tashlangan — kiyib ham, sotib olib ham bo'lmaydi */
  gone?: boolean;

  /*
   * Quyidagilar FAQAT ko'rsatish uchun va qurilmada saqlanmaydi: ilova
   * qayta ochilganda serverdan yangidan olinadi (narx o'zgargan bo'lishi
   * mumkin, yozuv esa kichik qolishi kerak).
   */
  title?: string;
  image?: string | null;
  price?: string;
  currency?: string;
}

/** Savatga qo'shish uchun kirish — holat (`on`, `gone`) ichkarida belgilanadi. */
export type TrayInput = Omit<TrayItem, 'on' | 'gone'>;

/** Kiyim shu havolaga (mahsulot yoki variant id) to'g'ri keladimi. */
export function matches(item: TrayItem, ref: string): boolean {
  return item.productId === ref || item.variantId === ref;
}

export function hasItem(tray: readonly TrayItem[], ref: string): boolean {
  return tray.some((item) => matches(item, ref));
}

/**
 * Ikki yozuv BITTA kiyimmi.
 *
 * ⚠️ MAHSULOT BO'YICHA HAM. Bitta mahsulotning ikki rangi savatda ikki
 * marta turmaydi: odam bir kurtkani ikki marta kiya olmaydi. Mahsulot
 * sahifasida boshqa rang tanlanib qayta qo'shilsa, eski rang almashadi.
 */
function sameGarment(a: TrayInput, b: TrayInput): boolean {
  return (
    (a.productId !== null && a.productId === b.productId) ||
    (a.variantId !== null && a.variantId === b.variantId)
  );
}

/** AI shu kiyimni kiydira oladimi (oyoq kiyimgacha; soat va sumka — yo'q). */
export function canWear(item: TrayItem): boolean {
  if (item.gone) return false;
  // Slot hali noma'lum bo'lsa to'sib qo'ymaymiz — aniqlangach qaror qilinadi
  return item.slot === null || supportsAiTryon(item.slot);
}

/**
 * «Bir turdan bittasi» — `winner` yoqilganda shu slotdagi qolganlar o'chadi.
 *
 * ⚠️ O'CHADI, O'CHIRILMAYDI. Ikkinchi futbolka savatda qoladi (xira
 * ko'rinishda) — foydalanuvchi uni bosib, birinchisining o'rniga qo'ya
 * oladi. Aynan shu «yoqmasa boshqasini kiyib ko'rish».
 */
function keepOnePerSlot(tray: readonly TrayItem[], winner: TrayItem): TrayItem[] {
  if (!winner.on || winner.slot === null) return [...tray];
  return tray.map((item) =>
    item !== winner && item.on && item.slot === winner.slot ? { ...item, on: false } : item,
  );
}

/**
 * Slot keyin ma'lum bo'lgan holat uchun: bir slotda ikkitasi yoqiq
 * qolgan bo'lsa, KEYIN qo'shilgani qoladi.
 */
function normalize(tray: readonly TrayItem[]): TrayItem[] {
  const taken = new Set<string>();
  const result: TrayItem[] = [];

  for (let index = tray.length - 1; index >= 0; index -= 1) {
    const item = tray[index]!;
    if (item.on && item.slot !== null) {
      if (taken.has(item.slot)) {
        result.unshift({ ...item, on: false });
        continue;
      }
      taken.add(item.slot);
    }
    result.unshift(item);
  }

  return result;
}

/** Sig'imdan oshsa eng eskilari tushib qoladi (yangisi ro'yxat oxirida). */
function capped(tray: TrayItem[]): TrayItem[] {
  return tray.length > TRAY_LIMIT ? tray.slice(tray.length - TRAY_LIMIT) : tray;
}

/**
 * Kiyimni savatga qo'shadi va yoqadi.
 *
 * Savatda bor bo'lsa — yangilanadi (rang almashgan bo'lishi mumkin) va
 * yoqiladi; joyi o'zgarmaydi, qator sakramasin.
 */
export function addItem(tray: readonly TrayItem[], input: TrayInput): TrayItem[] {
  const index = tray.findIndex((item) => sameGarment(item, input));

  if (index === -1) {
    const added: TrayItem = { ...input, on: true };
    return capped(keepOnePerSlot([...tray, added], added));
  }

  const current = tray[index]!;
  const added: TrayItem = {
    ...current,
    /*
     * ⚠️ BO'SH QIYMAT MAVJUDINI O'CHIRMAYDI. Bosh sahifa kartasi rangni
     * bilmaydi (`variantId: null`); mahsulot sahifasida tanlangan rang
     * o'sha kartadagi «Look» qayta bosilganda yo'qolib ketmasligi kerak.
     */
    productId: input.productId ?? current.productId,
    variantId: input.variantId ?? current.variantId,
    slot: input.slot ?? current.slot,
    title: input.title ?? current.title,
    image: input.image ?? current.image,
    price: input.price ?? current.price,
    currency: input.currency ?? current.currency,
    on: true,
    gone: false,
  };

  const next = tray.map((item, position) => (position === index ? added : item));
  return keepOnePerSlot(next, added);
}

export function removeItem(tray: readonly TrayItem[], ref: string): TrayItem[] {
  return tray.filter((item) => !matches(item, ref));
}

/** Kiyimni yoqadi yoki o'chiradi (savatda qoladi). */
export function toggleItem(tray: readonly TrayItem[], ref: string): TrayItem[] {
  const index = tray.findIndex((item) => matches(item, ref));
  if (index === -1) return [...tray];

  const current = tray[index]!;
  if (current.on) {
    return tray.map((item, position) => (position === index ? { ...item, on: false } : item));
  }

  // Kiyib bo'lmaydigan narsa yoqilmaydi — tugma esa ekranda o'chiq turadi
  if (!canWear(current)) return [...tray];

  const turnedOn: TrayItem = { ...current, on: true };
  const next = tray.map((item, position) => (position === index ? turnedOn : item));
  return keepOnePerSlot(next, turnedOn);
}

/**
 * Serverdan kelgan ma'lumotni yozuvga ko'chiradi.
 *
 * `garment === null` — mahsulot do'kondan olib tashlangan.
 *
 * ⚠️ IKKI YOZUV BITTAGA QO'SHILISHI MUMKIN. Kartadan (mahsulot id) va
 * saqlangan komplektdan (variant id) kelgan yozuvlar bitta kiyim ekani
 * faqat shu yerda — ikkala id ham ma'lum bo'lganda — bilinadi.
 */
export function resolveItem(
  tray: readonly TrayItem[],
  ref: string,
  garment: TrayInput | null,
): TrayItem[] {
  const index = tray.findIndex((item) => matches(item, ref));
  if (index === -1) return [...tray];

  const current = tray[index]!;

  if (garment === null) {
    return tray.map((item, position) =>
      position === index ? { ...item, gone: true, on: false } : item,
    );
  }

  const draft: TrayItem = { ...current, ...garment, gone: false };

  // Shu kiyimning savatdagi boshqa yozuvlari (endi ikkala id ham ma'lum)
  const twins = new Set<number>();
  tray.forEach((item, position) => {
    if (position !== index && sameGarment(item, draft)) twins.add(position);
  });

  const anyOn = draft.on || [...twins].some((position) => tray[position]!.on);
  const patched: TrayItem = { ...draft, on: anyOn && canWear(draft) };

  // Birlashgan yozuv eng oldingi joyda qoladi — qator tartibi buzilmasin
  const home = Math.min(index, ...twins);
  const merged: TrayItem[] = [];
  tray.forEach((item, position) => {
    if (position === home) merged.push(patched);
    else if (position !== index && !twins.has(position)) merged.push(item);
  });

  return normalize(merged);
}

/**
 * Faqat shu kiyimlarni kiyadi (saqlangan komplekt ochilganda).
 *
 * ⚠️ QOLGANLARI O'CHADI, YO'QOLMAYDI. Foydalanuvchi yig'gan kiyimlarni
 * komplekt ochilgani uchun yo'qotmasligi kerak — ular savatda nomzod
 * bo'lib qoladi.
 */
export function wearOnly(tray: readonly TrayItem[], inputs: readonly TrayInput[]): TrayItem[] {
  let next: TrayItem[] = tray.map((item) => (item.on ? { ...item, on: false } : item));
  for (const input of inputs) next = addItem(next, input);
  return next;
}

/** Hozir kiyintirishga ketadigan kiyimlar: yoqiq, mavjud va to'liq aniqlangan. */
export function selectedForTryon(tray: readonly TrayItem[]): TrayItem[] {
  return tray.filter(
    (item) =>
      item.on &&
      !item.gone &&
      item.variantId !== null &&
      item.slot !== null &&
      supportsAiTryon(item.slot),
  );
}

/** Yoqiq, lekin hali serverdan aniqlanmagan kiyimlar — so'rov ularni kutadi. */
export function unresolved(tray: readonly TrayItem[]): TrayItem[] {
  return tray.filter(
    (item) => item.on && !item.gone && (item.variantId === null || item.slot === null),
  );
}

/**
 * Mahsulot id bilan so'ralganda qaysi rang olinadi.
 *
 * ⚠️ SERVER ISTALGAN VARIANTNI QAYTARADI. `/tryon/garments?variantIds=`
 * mahsulot id ni ham qabul qiladi, lekin u holda javobdagi variant —
 * tasodifiy (id bo'yicha birinchisi), hatto omborda tugagani bo'lishi
 * mumkin. `colors` esa tartibli va faqat omborda borlari: birinchisi —
 * mahsulot sahifasi sukut bo'yicha ko'rsatadigan rang.
 *
 * Aniq variant so'ralgan bo'lsa (mahsulot sahifasi, saqlangan komplekt)
 * tanlovga tegilmaydi.
 */
export function preferredVariant(
  ref: string,
  row: { variantId: string; colors: ReadonlyArray<{ variantId: string }> },
): string {
  if (row.variantId === ref) return ref;
  if (row.colors.some((color) => color.variantId === ref)) return ref;
  return row.colors[0]?.variantId ?? row.variantId;
}

// ── Urinishlar ──

/**
 * Bitta kiyib ko'rish urinishi: qaysi kiyimlar va serverdagi natija yozuvi.
 *
 * ⚠️ NEGA QURILMADA SAQLANADI. Natija operator navbati orqali bir necha
 * daqiqada keladi; foydalanuvchi shu orada ilovani yopishi mumkin.
 * Qaytganda ekran shu yozuv bo'yicha holatni so'raydi. Serverdan
 * «shu to'plamning natijasi» ni boshqa yo'l bilan topib bo'lmaydi:
 * javobda to'plam belgisi yo'q, faqat yozuv `id` si.
 */
export interface TryRecord {
  /** `tryKey(variantIds)` */
  key: string;
  variantIds: string[];
  /** Kuzatiladigan natija yozuvi (`GET /tryon/render/:id`) */
  renderId: string;
  /** Oxirgi so'rov vaqti (ms) — kutish hisobi shundan */
  at: number;
}

/**
 * To'plam kaliti — tartibga bog'liq emas.
 *
 * ⚠️ SERVERGA HAM SHU TARTIBDA YUBORILADI. Operator ishi birinchi
 * variantning yozuviga bog'lanadi; tartib har safar boshqa bo'lsa bitta
 * to'plam uchun ikkita ish ochilib qolardi.
 */
export function sortedIds(variantIds: readonly string[]): string[] {
  return [...variantIds].sort();
}

export function tryKey(variantIds: readonly string[]): string {
  return sortedIds(variantIds).join(',');
}

export function findTry(tries: readonly TryRecord[], key: string): TryRecord | null {
  return tries.find((record) => record.key === key) ?? null;
}

/** Urinishni eslab qoladi — eng yangisi boshida, eskilari tushib qoladi. */
export function rememberTry(tries: readonly TryRecord[], record: TryRecord): TryRecord[] {
  return [record, ...tries.filter((item) => item.key !== record.key)].slice(0, TRIES_LIMIT);
}

export function forgetTry(tries: readonly TryRecord[], key: string): TryRecord[] {
  return tries.filter((record) => record.key !== key);
}

// ── Qurilmaga yozish ──

const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/**
 * Savatni ixcham matnga aylantiradi: `[mahsulot, variant, slot, yoqiq]`.
 *
 * ⚠️ NOM VA SURAT YOZILMAYDI. `SecureStore` 2 KB dan katta yozuvni
 * ishonchli saqlamaydi; 12 ta kiyim nomi va surat manzili bilan undan
 * ancha oshardi.
 */
export function packTray(tray: readonly TrayItem[]): string {
  return JSON.stringify(
    tray
      .filter((item) => !item.gone)
      .map((item) => [item.productId, item.variantId, item.slot, item.on ? 1 : 0]),
  );
}

/** Buzuq yoki begona yozuv ilovani yiqitmaydi — o'qib bo'lmagani tashlanadi. */
export function unpackTray(raw: string | null): TrayItem[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const tray: TrayItem[] = [];
  for (const entry of parsed) {
    if (!Array.isArray(entry)) continue;
    const [productId, variantId, slot, on] = entry as unknown[];
    if (!isId(productId) && !isId(variantId)) continue;

    tray.push({
      productId: isId(productId) ? productId : null,
      variantId: isId(variantId) ? variantId : null,
      slot: isId(slot) ? slot : null,
      on: on === 1,
    });
  }

  return normalize(capped(tray));
}

export function packTries(tries: readonly TryRecord[]): string {
  return JSON.stringify(tries.map((record) => [record.variantIds, record.renderId, record.at]));
}

export function unpackTries(raw: string | null): TryRecord[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const tries: TryRecord[] = [];
  for (const entry of parsed) {
    if (!Array.isArray(entry)) continue;
    const [variantIds, renderId, at] = entry as unknown[];
    if (!Array.isArray(variantIds) || variantIds.length === 0 || !variantIds.every(isId)) continue;
    if (!isId(renderId) || typeof at !== 'number') continue;

    const ids = sortedIds(variantIds);
    tries.push({ key: ids.join(','), variantIds: ids, renderId, at });
  }

  return tries.slice(0, TRIES_LIMIT);
}

/**
 * Eski yozuvni (`ai.outfit`) savatga ko'chiradi.
 *
 * Ikki xil qator bor edi: bosh sahifadan — `pick:<mahsulot id>` turkumi
 * bilan (id — MAHSULOTNIKI), qolgan joylardan — variant id bilan.
 */
export function migrateOutfit(raw: string | null): TrayItem[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  let tray: TrayItem[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const { category, variantId } = entry as { category?: unknown; variantId?: unknown };
    if (typeof category !== 'string' || !isId(variantId)) continue;

    const fromHome = category.startsWith('pick:');
    tray = addItem(tray, {
      productId: fromHome ? variantId : null,
      variantId: fromHome ? null : variantId,
      slot: null,
    });
  }

  return tray;
}
