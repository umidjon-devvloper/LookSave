/**
 * O'zbekcha qidiruv sinonim lug'ati — rang, mato va translit nomlari.
 *
 * Maqsad: «qovun rangi ro'mol» yozilganda «sariq ro'mol» ham topilsin;
 * «nayk krossovka» → «nike krossovka». Har sinonim uchun original so'rov
 * ustiga bitta variant yasaladi, va `products.ts` dagi qidiruv
 * variantlar bo'yicha OR qiladi.
 *
 * Bu asl `plainto_tsquery` + trigram'ni almashtirmaydi — ularni kengaytiradi,
 * shuning uchun hech bir eski qidiruv natijasi yo'qolmaydi.
 */

/**
 * Kalit — foydalanuvchi yozadigan kirish atama (lowercase).
 * Qiymat — qo'shimcha izlanadigan so'zlar (kalit o'zi bilan birga).
 *
 * Ikki yoki ko'proq so'zdan iborat kalitlar ham qabul qilinadi
 * («pista yashil») — avval ular tekshiriladi.
 */
const SYNONYMS: Record<string, readonly string[]> = {
  // Mevadan rang nomi — mahalliy nutqda keng tarqalgan
  qovun: ['sariq', 'orange'],
  'qovun rangi': ['sariq', 'orange'],
  pista: ['yashil', 'olive'],
  'pista yashil': ['olive', 'yashil olive'],
  xurmo: ['jigarrang', 'brown'],
  bulut: ['kulrang', 'grey'],
  anor: ['qizil', 'bordo'],
  nok: ['sariq', 'yellow'],
  olcha: ['bordo', 'burgundy'],
  limon: ['sariq', 'lemon'],
  shaftoli: ['pushti', 'peach'],
  jigar: ['jigarrang', 'brown'],
  tilla: ['oltin', 'gold'],
  kumush: ['silver'],

  // O'zbekcha → inglizcha rang (ikki tilli katalog uchun)
  qora: ['black'],
  oq: ['white'],
  qizil: ['red'],
  sariq: ['yellow'],
  yashil: ['green'],
  pushti: ['pink'],
  jigarrang: ['brown'],
  kulrang: ['grey'],
  "ko'k": ['blue'],
  binafsha: ['purple'],
  oltin: ['gold'],

  // Inglizcha → o'zbekcha (katalog o'zbekcha bo'lsa, ingliz qidiruvni qoplasin)
  black: ['qora'],
  white: ['oq'],
  red: ['qizil'],
  yellow: ['sariq'],
  green: ['yashil'],
  pink: ['pushti'],
  brown: ['jigarrang'],
  grey: ['kulrang'],
  gray: ['kulrang'],
  blue: ["ko'k"],
  purple: ['binafsha'],
  orange: ['sariq', 'qovun'],

  // Transliteratsiya — mahalliy foydalanuvchilar yozadigan brand shakli
  nayk: ['nike'],
  'adi das': ['adidas'],
  pume: ['puma'],
  zara: ['zara'],

  // Kiyim turlari — ingliz/o'zbek
  shim: ['trousers', 'pants'],
  trousers: ['shim'],
  pants: ['shim'],
  "ko'ylak": ['dress'],
  dress: ["ko'ylak"],
  futbolka: ['tshirt'],
  tshirt: ['futbolka'],
  't-shirt': ['futbolka'],
  // ⚠️ Jonli katalog «Krasovka» deb yozadi (2026-11-24) — «krossovka» deb
  // qidirgan odam ham topsin, va aksincha.
  krossovka: ['sneakers', 'krasovka', 'krossovki'],
  krasovka: ['krossovka', 'sneakers'],
  sneakers: ['krossovka', 'krasovka'],
  sumka: ['barsetka', 'bag'],
  barsetka: ['sumka', 'bag'],
  bag: ['sumka', 'barsetka'],
  kepka: ['cap', 'beysbolka'],
  beysbolka: ['kepka', 'cap'],
  cap: ['kepka'],
  "etik": ['boots'],
  boots: ['etik'],
  "ro'mol": ['scarf', 'rumol'],
  scarf: ["ro'mol"],

  // Mato — muhim moda kalitlari
  shoyi: ['silk'],
  silk: ['shoyi'],
  jun: ['wool'],
  wool: ['jun'],
  paxta: ['cotton'],
  cotton: ['paxta'],
  teri: ['leather'],
  leather: ['teri'],
  denim: ['jeans', 'jinsi'],
  jinsi: ['denim', 'jeans'],
};

/**
 * So'rov variantlarini yasaydi. Birinchisi — asl so'rov, qolganlari — bitta
 * sinonim bilan almashtirilgan versiyalar.
 *
 * Misol:
 *   "qovun ro'mol" → [
 *     "qovun ro'mol",
 *     "sariq ro'mol",
 *     "orange ro'mol",
 *     "qovun scarf",
 *     "qovun rumol",
 *     ...
 *   ]
 *
 * `maxVariants` kombinatorial portlashni tiyadi — ko'p so'zli so'rovlar
 * uchun ham to'g'ri parametr soni (odatda 8 variant kifoya).
 */
export function expandSearchQuery(q: string, maxVariants = 8): string[] {
  const cleaned = q.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!cleaned) return [];

  const variants = new Set<string>([cleaned]);

  // Avval ko'p so'zli kalitlar: "pista yashil" bitta atama sifatida tanilsin.
  const multiKeys = Object.keys(SYNONYMS).filter((k) => k.includes(' '));
  for (const key of multiKeys) {
    if (!cleaned.includes(key)) continue;
    for (const syn of SYNONYMS[key] ?? []) {
      variants.add(cleaned.split(key).join(syn));
      if (variants.size >= maxVariants) return [...variants];
    }
  }

  // Keyin so'z-so'z: har tokenni o'z sinonimi bilan almashtirib ko'ramiz.
  const tokens = cleaned.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!tok) continue;
    const syns = SYNONYMS[tok];
    if (!syns) continue;
    for (const syn of syns) {
      const copy = [...tokens];
      copy[i] = syn;
      variants.add(copy.join(' '));
      if (variants.size >= maxVariants) return [...variants];
    }
  }

  return [...variants];
}
