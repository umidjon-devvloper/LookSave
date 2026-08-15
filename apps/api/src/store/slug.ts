/**
 * Do'kon nomidan URL uchun `slug`.
 *
 * Sof funksiya — bazaga tegmaydi, testlanadi. Takrorlanishni tekshirish
 * chaqiruvchida (`apply.ts`), chunki u `stores.slug` UNIQUE cheklovini
 * biladi.
 *
 * ⚠️ Transliteratsiya to'liq emas va bo'la olmaydi ham: "Чилонзор" va
 * "Chilonzor" bir xil slug beradi, bu to'g'ri; lekin arabcha nom
 * ("متجر الأزياء") lotin harflari bermaydi va bo'sh qoladi. Shu holat
 * uchun zaxira yo'l bor — pastga qarang.
 */

/**
 * Kirill → lotin. O'zbek va rus alifbolari uchun.
 *
 * Ikki harfli mosliklar birinchi tekshiriladi: "щ" → "sh" bo'lib
 * qolmasligi kerak, u "shch".
 */
const CYRILLIC: ReadonlyArray<readonly [string, string]> = [
  ['щ', 'shch'],
  ['ю', 'yu'],
  ['я', 'ya'],
  ['ж', 'j'],
  ['ч', 'ch'],
  ['ш', 'sh'],
  ['ё', 'yo'],
  ['ъ', ''],
  ['ь', ''],
  ['ы', 'i'],
  ['э', 'e'],
  ['а', 'a'],
  ['б', 'b'],
  ['в', 'v'],
  ['г', 'g'],
  ['д', 'd'],
  ['е', 'e'],
  ['з', 'z'],
  ['и', 'i'],
  ['й', 'y'],
  ['к', 'k'],
  ['л', 'l'],
  ['м', 'm'],
  ['н', 'n'],
  ['о', 'o'],
  ['п', 'p'],
  ['р', 'r'],
  ['с', 's'],
  ['т', 't'],
  ['у', 'u'],
  ['ф', 'f'],
  ['х', 'x'],
  ['ц', 'ts'],
  ['ў', 'o'],
  ['қ', 'q'],
  ['ғ', 'g'],
  ['ҳ', 'h'],
];

/** O'zbek lotin apostroflari: o‘, g‘ — ular slugda tushib qoladi. */
const APOSTROPHES = /['’‘`´]/g;

export function transliterate(input: string): string {
  let result = input.toLowerCase().replace(APOSTROPHES, '');

  for (const [cyrillic, latin] of CYRILLIC) {
    result = result.split(cyrillic).join(latin);
  }

  return result;
}

export const SLUG_MAX = 60;

/**
 * Nomdan slug. Lotin harflari chiqmasa `null` qaytadi — chaqiruvchi
 * zaxira nom ishlatadi (masalan `store-a3f8k2`).
 */
export function slugify(name: string): string | null {
  const slug = transliterate(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    // Kesishdan keyin oxirida tire qolishi mumkin
    .replace(/-+$/g, '');

  return slug.length >= 2 ? slug : null;
}

/**
 * Band bo'lgan slugga raqam qo'shish: `chilonzor-fashion-2`.
 *
 * `taken` — bazadan olingan mavjud sluglar. Raqam ketma-ket qidiriladi:
 * do'kon nomlari takrorlanishi kam, shuning uchun sikl qisqa.
 * Chegara qo'yilgan — cheksiz sikl bo'lmasin.
 */
export function uniqueSlug(base: string, taken: ReadonlySet<string>, limit = 50): string | null {
  if (!taken.has(base)) return base;

  for (let index = 2; index <= limit; index += 1) {
    const suffix = `-${index}`;
    // Umumiy uzunlik chegaradan oshmasin
    const candidate = `${base.slice(0, SLUG_MAX - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }

  return null;
}
