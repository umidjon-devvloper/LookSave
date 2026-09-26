/**
 * Komplekt — kiyim ustiga kiyim.
 *
 * ⚠️ NEGA ALOHIDA MODUL. Bu mantiq ekranga tegmaydi va aynan shu sababli
 * sinaladi: zanjirning bitta halqasi noto'g'ri bog'lansa foydalanuvchi
 * kurtkani futbolka ustida emas, yalang'och gavdada ko'radi — va buni
 * ekranni qo'lda ochib topish qiyin.
 *
 * ⚠️ NEGA `@looksave/validation` DA, ILOVA ICHIDA EMAS — GARCHI BU ZOD
 * SXEMASI BO'LMASA HAM. Uni UCH tomon ishlatadi: mobil ilova, saytning
 * brauzer qismi va saytning BFF `loader` i (u zanjirni SERVERDA tiklab,
 * tayyor asosni qaytaradi). Kiyinish tartibi ular orasida ajralib
 * ketsa, bir tomonda kurtka futbolka ustiga, ikkinchisida ostiga
 * tushardi — va nosozlik faqat SURATDA ko'rinardi, kodda emas.
 *
 * Bu paketda `AI_TRYON_SLOTS` ham aynan shu sababdan turibdi
 * (`tryon.ts` dagi izoh).
 *
 * ASOSIY FIKR: komplekt — TANLOVLAR RO'YXATI, natijalar ro'yxati emas.
 * Har qatlamda faqat «qaysi turkumda qaysi kiyim» yoziladi; kiyintirilgan
 * suratlar esa serverdan keladi va shu ro'yxat ustiga MOSLANADI
 * (`resolveOutfit`).
 *
 * Shunday qilinganining sababi: pastki qatlam almashsa (futbolka
 * o'zgarsa) tepadagilarning surati eskiradi — ular BOSHQA asos ustiga
 * chizilgan edi. Agar ro'yxatda natijalar saqlansa, ularni qo'lda
 * tozalash kerak bo'lardi va bitta unutilgan joy foydalanuvchiga eski
 * suratni ko'rsatardi. Bu yerda esa eskirgan natija shunchaki TOPILMAYDI
 * va qatlam «hali yasalmagan» holatiga tushadi.
 */

/**
 * Zanjir uchun kerak bo'ladigan MINIMAL natija shakli.
 *
 * ⚠️ ATAYIN TO'LIQ `TryonRender` EMAS. To'liq tip ikkala ilovada ham
 * o'zining API mijozida yashaydi; paket ularga bog'lanmasligi kerak,
 * aks holda bog'liqlik teskari yo'nalishga ketardi. Struktura mos
 * kelsa yetarli — ikkala ilovaning tipi ham buni qanoatlantiradi.
 */
export interface LayerRender {
  id: string;
  variantId: string;
  baseRenderId: string | null;
  status: 'pending' | 'processing' | 'ready' | 'failed';
}

/*
 * ⚠️ QUYIDAGI FUNKSIYALAR GENERIK — VA BU SHART EMAS, BALKI ZARUR.
 *
 * Ular `LayerRender` ga qaytsa, chaqiruvchi o'z tipining QOLGAN
 * maydonlarini (surat manzili, xato matni) yo'qotardi: TypeScript
 * natijani torroq tipga siqib qo'yardi. Ekranga esa aynan o'sha
 * maydonlar kerak.
 *
 * `R extends LayerRender` bilan modul o'ziga kerakli to'rt maydonni
 * talab qiladi, qolganini esa tegmasdan o'tkazib yuboradi.
 */

/**
 * Kiyinish tartibi — pastdan tepaga.
 *
 * ⚠️ MAKETDAGI TAB TARTIBI EMAS. Tablarda kiyimlar ko'rish qulayligi
 * bo'yicha turadi (Futbolka · Xudi · Kurtka · Ko'ylak · Shim), bu yerda
 * esa ular HAQIQATDA qanday kiyilsa shunday: shimni kurtkadan keyin
 * kiyib bo'lmaydi.
 *
 * Tartib zanjirni belgilaydi: har kiyim o'zidan PASTDAGI eng tepa
 * qatlamning surati ustiga kiydiriladi.
 */
export const LAYER_ORDER = ['trousers', 'tshirt', 'shirt', 'hoodie', 'jacket'] as const;

export type LayerCategory = (typeof LAYER_ORDER)[number];

export interface OutfitLayer {
  category: string;
  variantId: string;
}

/**
 * Turkum tanada qaysi slotga tushadi.
 *
 * ⚠️ O'LCHAM TAVSIYASI SHUNDAN HISOBLANADI: ustki kiyim ko'krakdan,
 * pastki kiyim beldan (`recommendSize`). Turkum va slot bir xil narsa
 * emas — futbolka, xudi va ko'ylak uchalasi ham `top` slotida.
 */
const CATEGORY_SLOT: Record<string, string> = {
  trousers: 'bottom',
  tshirt: 'top',
  shirt: 'top',
  hoodie: 'top',
  jacket: 'outer',
};

/**
 * Turkumning sloti.
 *
 * ⚠️ NOMA'LUM TURKUM `top` GA TUSHADI — eng keng tarqalgan hol va u
 * hech bo'lmasa ko'krak o'lchamidan tavsiya beradi. `null` qaytarilsa
 * o'lcham filtri jimgina o'chib qolardi.
 */
export function slotForCategory(category: string): string {
  return CATEGORY_SLOT[category] ?? 'top';
}

/**
 * Turkumning zanjirdagi o'rni.
 *
 * ⚠️ NOMA'LUM TURKUM ENG TEPAGA TUSHADI. Katalogda yangi turkum paydo
 * bo'lsa (masalan «palto») u bu ro'yxatda bo'lmaydi. Uni pastga qo'ysak
 * mavjud kiyimlarning ustiga chiqib, ularni bekitardi; tepaga qo'yilsa
 * esa eng yomon holatda ham komplekt ustidan kiyiladi — bu ko'pchilik
 * ustki kiyim uchun to'g'ri.
 */
export function layerRank(category: string): number {
  const index = (LAYER_ORDER as readonly string[]).indexOf(category);
  return index === -1 ? LAYER_ORDER.length : index;
}

/** Kiyinish tartibida joylaydi — zanjir shu tartibda quriladi. */
export function sortOutfit(layers: OutfitLayer[]): OutfitLayer[] {
  return [...layers].sort((a, b) => layerRank(a.category) - layerRank(b.category));
}

/**
 * Turkumga kiyim qo'yadi (yoki almashtiradi).
 *
 * ⚠️ TEPADAGILAR O'CHIRILMAYDI. Futbolka almashtirilganda kurtka
 * ro'yxatda QOLADI — faqat uning surati eskiradi va `resolveOutfit` uni
 * «yasalmagan» deb belgilaydi. Ekran esa yangi asos tayyor bo'lishi
 * bilan uni qaytadan so'raydi.
 *
 * Muqobil yo'l — tepadagilarni tashlab yuborish — arzonroq bo'lardi,
 * lekin foydalanuvchi futbolkani almashtirganda kurtkasini YO'QOTARDI
 * va uni qo'lda qayta tanlashi kerak bo'lardi.
 */
export function setLayer(
  outfit: OutfitLayer[],
  category: string,
  variantId: string,
): OutfitLayer[] {
  const without = outfit.filter((layer) => layer.category !== category);
  return sortOutfit([...without, { category, variantId }]);
}

/** Turkumni komplektdan olib tashlaydi («Yechish»). */
export function clearLayer(outfit: OutfitLayer[], category: string): OutfitLayer[] {
  return outfit.filter((layer) => layer.category !== category);
}

/**
 * Natija qidiruvining kaliti.
 *
 * ⚠️ ASOS KALITGA KIRADI. Bitta kurtkaning bir necha natijasi bo'ladi:
 * yalang'och gavdaga kiydirilgani, futbolka ustiga kiydirilgani, ko'ylak
 * ustiga kiydirilgani. Faqat `variantId` bo'yicha izlansa ulardan
 * tasodifiy bittasi topilardi.
 */
export function renderKey(variantId: string, baseRenderId: string | null): string {
  return `${variantId}|${baseRenderId ?? 'root'}`;
}

/**
 * Serverdan kelgan natijalarni qidiruvga qulay ko'rinishga o'tkazadi.
 *
 * ⚠️ BIR KALITGA BIR NECHTA NATIJA TUSHISHI MUMKIN — VA BIRINCHISI YUTADI.
 *
 * `scope: 'all'` bitta `(variantId, baseRenderId)` juftligi uchun bir
 * necha qator qaytarishi mumkin: manba o'zgarganda (yangi surat) yoki
 * generatsiya retsepti o'zgarganda (AI modeli almashganda) eski qator
 * bazada qoladi va yangisi yoniga qo'shiladi.
 *
 * ⚠️ TARTIB SHARTNOMASI: chaqiruvchi YANGISINI BIRINCHI beradi
 * (`listRenders` — `ORDER BY created_at DESC`). Ilgari bu yerda
 * `map.set` shartsiz chaqirilardi, ya'ni OXIRGISI yutardi — va oxirgisi
 * aynan ENG ESKISI edi. Natijada model almashtirilgandan keyin ham
 * komplektda eski, yuzi buzuq surat ko'rinardi: hamma narsa to'g'ri
 * ishlayotgandek tuyulardi, chunki yangisi bazada bor edi.
 */
export function indexRenders<R extends LayerRender>(renders: readonly R[]): Map<string, R> {
  const map = new Map<string, R>();
  for (const render of renders) {
    const key = renderKey(render.variantId, render.baseRenderId);
    if (!map.has(key)) map.set(key, render);
  }
  return map;
}

export interface ResolvedLayer<R extends LayerRender = LayerRender> extends OutfitLayer {
  /** Qaysi natija ustiga kiydiriladi. `null` — asl suratga */
  baseRenderId: string | null;
  /** Topilgan natija — yo'q bo'lsa hali so'ralmagan */
  render: R | undefined;
  /**
   * Ostidagi qatlam hali tayyor emas.
   *
   * ⚠️ BU «XATO» EMAS, «NAVBAT». Bunday qatlamni so'rab bo'lmaydi —
   * asosi yo'q — lekin u komplektda qoladi va asos tayyor bo'lishi bilan
   * o'zi so'raladi.
   */
  blocked: boolean;
}

/**
 * Komplektni zanjirga aylantiradi.
 *
 * Pastdan tepaga yuriladi: har qatlamning asosi — undan pastdagi eng
 * tepa TAYYOR natija. Biror qatlam tayyor bo'lmasa, undan yuqoridagilar
 * `blocked` bo'ladi: ularning asosi hali mavjud emas.
 */
export function resolveOutfit<R extends LayerRender>(
  outfit: readonly OutfitLayer[],
  renders: Map<string, R>,
): Array<ResolvedLayer<R>> {
  const resolved: Array<ResolvedLayer<R>> = [];

  let base: string | null = null;
  let blocked = false;

  for (const layer of sortOutfit([...outfit])) {
    if (blocked) {
      resolved.push({ ...layer, baseRenderId: null, render: undefined, blocked: true });
      continue;
    }

    const render = renders.get(renderKey(layer.variantId, base));
    resolved.push({ ...layer, baseRenderId: base, render, blocked: false });

    if (render?.status === 'ready') base = render.id;
    else blocked = true;
  }

  return resolved;
}

export interface CategoryBase {
  /** Ustiga kiydiriladigan natija. `null` — asl surat */
  baseRenderId: string | null;
  /**
   * Asos haqiqatan tayyormi.
   *
   * ⚠️ `false` BO'LSA HECH NARSA SO'RALMASLIGI KERAK. Ostidagi qatlam
   * hali kelmagan — hozir so'ralgan surat o'sha qatlamsiz chiqadi va
   * asos tayyor bo'lishi bilan TASHLANADI. Ya'ni bekorga to'langan
   * kredit.
   */
  ready: boolean;
}

/**
 * Berilgan turkum uchun asos — undan PASTDAGI eng tepa tayyor natija.
 *
 * Tasmadagi har kiyim shu asos ustida ko'rsatiladi: foydalanuvchi
 * kurtkalar tabini ochganda ularning hammasini o'zining futbolkali
 * suratida ko'radi, yalang'och gavdada emas.
 */
export function baseForCategory(
  resolved: readonly ResolvedLayer<LayerRender>[],
  category: string,
): CategoryBase {
  const rank = layerRank(category);

  let base: string | null = null;
  for (const layer of resolved) {
    // O'zi va o'zidan tepadagilar asos bo'la olmaydi
    if (layerRank(layer.category) >= rank) break;
    if (layer.render?.status !== 'ready') return { baseRenderId: base, ready: false };
    base = layer.render.id;
  }

  return { baseRenderId: base, ready: true };
}

/**
 * Ekranda ko'rsatiladigan natija — zanjirdagi eng TEPA tayyor surat.
 *
 * ⚠️ ENG OXIRGISI EMAS, ENG TEPA TAYYORI. Kurtka so'ralgan va hali
 * kelmagan bo'lsa ekranda futbolkali surat turishi kerak — bo'sh joy
 * emas.
 */
export function topReady<R extends LayerRender>(resolved: readonly ResolvedLayer<R>[]): R | null {
  let found: R | null = null;
  for (const layer of resolved) {
    if (layer.render?.status === 'ready') found = layer.render;
  }
  return found;
}

/**
 * Keyingi so'raladigan qatlam.
 *
 * Zanjir pastdan tepaga tiklanadi: bir vaqtda faqat BITTA qatlam
 * so'raladi, chunki keyingisining asosi shu natija bo'ladi. Hammasini
 * birdan so'rash mumkin emas — asos `id` si hali mavjud emas.
 *
 * `null` — hammasi tayyor yoki ish allaqachon ketmoqda.
 */
export function nextPending<R extends LayerRender>(
  resolved: readonly ResolvedLayer<R>[],
): ResolvedLayer<R> | null {
  for (const layer of resolved) {
    if (layer.blocked) return null;
    if (!layer.render) return layer;
    if (layer.render.status !== 'ready') return null;
  }
  return null;
}

/**
 * Zanjirni FRONT renderlariga qarab tiklab, har qatlamning JORIY
 * BURCHAKDAGI renderini beradi (yon · orqa uchun).
 *
 * ⚠️ NEGA KERAK. Server operator 3 panelli varaqni chizib, qo'shimcha
 * burchaklarni (yon · orqa) yozganda, ularning `baseRenderId` maydonini
 * so'rov ishlatgan FRONT bazasi bilan yozadi (bir generatsiya — bir
 * `base`). Ya'ni yon renderning kaliti (variantId, FRONT_base), yon
 * bazasi emas. Oddiy `resolveOutfit` yon burchakda yon zanjirini
 * qursa — birinchi qatlam yon renderi boshqa `id` oladi va keyingi
 * qatlamlarning bazasi mos kelmaydi.
 *
 * Bu funksiya FRONT zanjirini yuradi (baza id'larini FRONT renderdan
 * oladi), har qatlam uchun esa JORIY burchak renderini shu bazadan
 * izlaydi — natijada yon/orqada zanjir uzilmaydi.
 */
export function resolveAtFrontChain<R extends LayerRender>(
  outfit: readonly OutfitLayer[],
  frontRenders: Map<string, R>,
  angleRenders: Map<string, R>,
): Array<ResolvedLayer<R>> {
  const resolved: Array<ResolvedLayer<R>> = [];

  let frontBase: string | null = null;
  let blocked = false;

  for (const layer of sortOutfit([...outfit])) {
    if (blocked) {
      resolved.push({ ...layer, baseRenderId: null, render: undefined, blocked: true });
      continue;
    }

    const front = frontRenders.get(renderKey(layer.variantId, frontBase));
    const render = angleRenders.get(renderKey(layer.variantId, frontBase));
    resolved.push({ ...layer, baseRenderId: frontBase, render, blocked: false });

    if (front?.status === 'ready') frontBase = front.id;
    else blocked = true;
  }

  return resolved;
}
