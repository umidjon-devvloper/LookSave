/**
 * seed-catalog.ts — demo do'kon uchun ko'rsatsa bo'ladigan katalog.
 *
 * ⚠️ NEGA BU SKRIPT KERAK. `dev_seed.sql` do'kon va kategoriya beradi,
 * lekin mahsulot bermaydi. Natijada bazadagi katalog qo'lda kiritilgan
 * sinov chiqindisidan iborat edi: 10 ta `active` mahsulotning 8 tasida
 * na rasm, na o'lcham, na zaxira bor. Bunday mahsulot ilovada bo'sh
 * kvadrat bo'lib turadi va unga buyurtma ham bermaydi.
 *
 * ⚠️ SURAT RENDER QILINADI, YUKLAB OLINMAYDI — VA SABABI PRINSIPIAL.
 * Kartochkadagi surat va svaypdagi 3D BIR XIL buyum bo'lishi shart.
 * Tashqi surat olinsa, mijoz kartochkada bir kiyimni ko'rib, kiyib
 * ko'rganda boshqasini olardi. Bu yerda ikkalasi ham bitta GLB dan
 * keladi: `render-product.py` suratni yasaydi, `from-photo.mjs` esa
 * o'sha suratdan rangni o'qib 3D ni qayta quradi.
 *
 * ⚠️ KATALOG HAJMI GENERATOR BILAN CHEGARALANGAN, XOHISH BILAN EMAS.
 * `lib/garments.mjs` da atigi olti qolip bor: tshirt, jacket, pants,
 * sneakers, cap, watch. Ya'ni «xudi» yoki «yubka» qo'shilsa, u
 * kartochkada futbolka bo'lib ko'rinardi. Shuning uchun bu yerda faqat
 * qolipi bor buyumlar turibdi — soni kam, lekin har biri haqiqiy.
 *
 * ⚠️ OLTI QOLIPDAN FAQAT UCHTASI ISHLATILADI (2026-08-29 da ko'z bilan
 * tekshirildi). `cap`, `sneakers` va `watch` render qilinganda mos
 * ravishda BOSH, oq dog' va tuxumga o'xshaydi — geometriyasi avatarda
 * rangli siluet uchun yetarli, lekin katalog surati uchun emas.
 * Tafsilot: `render-product.py` sarlavhasida. Ular modellar
 * yaxshilangach qaytariladi; hozir «krossovka» deb oq dog' sotish
 * mahsulotni noto'g'ri ko'rsatgan bo'lardi.
 *
 * ⚠️ MAHSULOT `createProduct` ORQALI YARATILADI, SQL BILAN EMAS.
 * To'g'ridan-to'g'ri INSERT `slot` ni kategoriyadan ko'chirishni,
 * valyutani do'kondan olishni, `variant_stock` ni va 3D navbatini
 * chetlab o'tardi — ya'ni seed ma'lumoti panel yaratganidan boshqacha
 * bo'lib qolardi va nuqson faqat ilovada ko'rinardi.
 *
 * Ishga tushirish (apps/api ichidan):
 *
 *   npm run seed:catalog --workspace=apps/api            # quruq yurish
 *   npm run seed:catalog --workspace=apps/api -- --apply
 *
 * Bayroqlar:
 *   --apply             haqiqatan yozadi (aks holda faqat rejani ko'rsatadi)
 *   --store=<slug>      boshqa do'konga (standart: chilonzor-fashion)
 *   --keep-renders      vaqtinchalik PNG larni o'chirmaydi (tekshirish uchun)
 *   --archive-existing  do'kondagi BARCHA mavjud mahsulotni arxivlaydi
 *
 * ⚠️ `--archive-existing` DO'KONNI BO'SHATADI, tanlab emas. U demo
 * do'konni tozalash uchun: chiqindi sinov mahsulotlari o'rnini shu
 * katalog egallaydi. Haqiqiy do'konga yo'naltirilsa uning butun
 * vitrinasi katalogdan yo'qoladi. Mahsulot O'CHIRILMAYDI — `archived`
 * ga o'tadi, ya'ni eski buyurtmalar buzilmaydi va qaytarish mumkin.
 */

import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createProductSchema } from '@looksave/validation';
// `sharp` bu yerda e'lon qilinmagan: u `@imgly/background-removal-node`
// (apps/api ning bevosita bog'liqligi) bilan birga keladi. `from-photo.mjs`
// ham shunday ishlatadi. Skript faqat ishlab chiqish uchun — API bundle'iga
// tushmaydi, shuning uchun alohida qator qo'shilmadi.
import sharp from 'sharp';

import { pool } from '../src/db/pool';
import { uploadObject } from '../src/integrations/r2';
import { archiveProduct, createProduct } from '../src/store/products';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const BLENDER = '/Applications/Blender.app/Contents/MacOS/Blender';
const RENDERER = join(REPO, 'assets-3d', 'generator', 'render-product.py');

/** `render-product.py` dagi BACKDROP bilan bir xil bo'lishi shart. */
const BACKDROP = '#F5F5F7';

/**
 * Qolip → qaysi GLB dan shakl olinadi.
 *
 * ⚠️ FAYLDAGI RANG AHAMIYATSIZ: `render-product.py` materialni butunlay
 * almashtiradi. Bu yerda faqat GEOMETRIYA tanlanadi, shuning uchun har
 * qolipdan bittasi yetarli.
 *
 * Pastdagi uchtasi hozir KATALOGDA ISHLATILMAYDI (sarlavhadagi izoh) —
 * jadval to'liq qoldirilgan, chunki qolip yaxshilangach mahsulot
 * qo'shishdan boshqa hech narsa o'zgarmaydi.
 */
const SHAPE_FILE = {
  tshirt: 'tshirt-white-v1.glb',
  jacket: 'jacket-denim-v1.glb',
  pants: 'pants-graphite-v1.glb',
  sneakers: 'sneakers-white-v1.glb',
  cap: 'cap-black-v1.glb',
  watch: 'watch-steel-v1.glb',
} as const;

type Shape = keyof typeof SHAPE_FILE;

interface DemoVariant {
  color: { uz: string; ru: string; en: string };
  hex: string;
  sizes: Array<{ size: string; stock: number }>;
}

interface DemoProduct {
  key: string;
  shape: Shape;
  title: string;
  description: string;
  categorySlug: string;
  gender: 'male' | 'female' | 'unisex';
  basePrice: string;
  oldPrice?: string;
  tags: string[];
  variants: DemoVariant[];
}

/** Kiyim o'lchamlari — `size_type = 'clothing'` kategoriyalar uchun. */
const clothing = (s: number, m: number, l: number, xl: number) => [
  { size: 'S', stock: s },
  { size: 'M', stock: m },
  { size: 'L', stock: l },
  { size: 'XL', stock: xl },
];

/*
 * ⚠️ ZAXIRA ATAYLAB NOTEKIS, ba'zi o'lchamda 0. Hamma o'lchamda bir xil
 * son turgan katalog darhol «seed» bo'lib ko'rinadi va «tugagan o'lcham»
 * holatini ilovada hech qachon sinab ko'rib bo'lmaydi.
 */
const CATALOG: DemoProduct[] = [
  {
    key: 'futbolka-bazaviy',
    shape: 'tshirt',
    title: 'Bazaviy paxta futbolka',
    description:
      '100% tarangan paxta, 180 g/m². Yuvishdan keyin shaklini saqlaydi, ' +
      "yoqasi cho'zilmaydi. Kundalik kiyim uchun — yakka o'zi ham, " +
      'ustidan kurtka bilan ham.',
    categorySlug: 'tshirt',
    gender: 'unisex',
    basePrice: '129000.00',
    tags: ['paxta', 'kundalik', 'bazaviy'],
    variants: [
      {
        color: { uz: 'Oq', ru: 'Белый', en: 'White' },
        hex: '#F2F2F5',
        sizes: clothing(6, 14, 11, 4),
      },
      {
        color: { uz: 'Qora', ru: 'Чёрный', en: 'Black' },
        hex: '#1C1A22',
        sizes: clothing(5, 12, 9, 6),
      },
      {
        color: { uz: 'Binafsha', ru: 'Фиолетовый', en: 'Violet' },
        hex: '#8B5CF6',
        sizes: clothing(3, 7, 5, 0),
      },
    ],
  },
  {
    key: 'futbolka-rangli',
    shape: 'tshirt',
    title: 'Rangli futbolka',
    description:
      "Qalinroq paxta, 210 g/m². Rangi quyoshda so'nmaydigan reaktiv " +
      "bo'yoq bilan berilgan. Kesimi bazaviysi bilan bir xil.",
    categorySlug: 'tshirt',
    gender: 'unisex',
    basePrice: '149000.00',
    tags: ['paxta', 'rangli'],
    variants: [
      {
        color: { uz: "Ko'k", ru: 'Синий', en: 'Blue' },
        hex: '#2F5FA8',
        sizes: clothing(4, 9, 8, 3),
      },
      {
        color: { uz: 'Yashil', ru: 'Зелёный', en: 'Green' },
        hex: '#3E7A5C',
        sizes: clothing(2, 6, 6, 2),
      },
      {
        color: { uz: 'Terrakota', ru: 'Терракота', en: 'Terracotta' },
        hex: '#B4523C',
        sizes: clothing(0, 5, 4, 2),
      },
    ],
  },
  {
    /*
     * ⚠️ NOM QOLIPGA QARAB TANLANGAN, XOHISHGA QARAB EMAS. `jacket`
     * qolipi — yoqasiz, tugmasiz, cho'ntaksiz uzun yengli ustki qavat.
     * «Jinsi kurtka» deb atalsa, tavsifdagi cho'ntak va tugmalar
     * suratda YO'Q bo'lardi — ya'ni kartochka mavjud bo'lmagan
     * xususiyatni va'da qilardi.
     */
    key: 'kurtka-yengil',
    shape: 'jacket',
    title: 'Yengil kurtka',
    description:
      "Uzun yengli yengil ustki qavat, denim to'qimali mato. Yoqasi va " +
      "tugmasi yo'q — boshdan kiyiladi. Kuz va bahor uchun: futbolka " +
      'ustidan salqin kunlarda.',
    categorySlug: 'jacket',
    gender: 'unisex',
    basePrice: '449000.00',
    oldPrice: '560000.00',
    tags: ['denim', 'kuzgi', 'chegirma'],
    variants: [
      {
        color: { uz: "Ko'k", ru: 'Синий', en: 'Blue' },
        hex: '#3B5A8C',
        sizes: clothing(3, 8, 7, 3),
      },
      {
        color: { uz: 'Qora', ru: 'Чёрный', en: 'Black' },
        hex: '#23222A',
        sizes: clothing(2, 6, 5, 1),
      },
    ],
  },
  {
    /*
     * ⚠️ KURTKADAGI KABI — NOM VA TAVSIF QOLIPGA QARAB. `pants` qolipi
     * tanaga yopishgan tor shim beradi: strelka ham, cho'ntak ham,
     * kamar halqasi ham yo'q. «To'g'ri kesim, dazmol izi uzoq turadi»
     * degan tavsif suratda ko'rinmaydigan narsani va'da qilardi.
     */
    key: 'shim-klassik',
    shape: 'pants',
    title: 'Tor kesimli shim',
    description:
      "Cho'ziluvchan gabardin, oyoqqa yopishib turadigan tor kesim. " +
      'Pastga tomon toraytirilgan, bel qismi rezinali — kamar kerak emas.',
    categorySlug: 'trousers',
    gender: 'male',
    basePrice: '299000.00',
    tags: ['klassik', 'ofis'],
    variants: [
      {
        color: { uz: 'Grafit', ru: 'Графит', en: 'Graphite' },
        hex: '#3A3746',
        sizes: clothing(4, 10, 8, 5),
      },
      {
        color: { uz: 'Qora', ru: 'Чёрный', en: 'Black' },
        hex: '#1E1D24',
        sizes: clothing(3, 9, 7, 4),
      },
    ],
  },
  {
    key: 'shim-chino',
    shape: 'pants',
    title: 'Chino shim',
    description:
      'Paxta-elastan chino, tor kesim. Kundalik kiyim: krossovka bilan ' +
      'ham, tufli bilan ham yarashadi.',
    categorySlug: 'trousers',
    gender: 'male',
    basePrice: '279000.00',
    tags: ['chino', 'kundalik'],
    variants: [
      {
        color: { uz: 'Bej', ru: 'Бежевый', en: 'Beige' },
        hex: '#C6B294',
        sizes: clothing(3, 7, 6, 2),
      },
      {
        color: { uz: 'Zaytun', ru: 'Оливковый', en: 'Olive' },
        hex: '#6B6A4B',
        sizes: clothing(2, 5, 5, 0),
      },
    ],
  },
];

// ── Argumentlar ──────────────────────────────────────────────────────────

const APPLY = process.argv.includes('--apply');
const KEEP = process.argv.includes('--keep-renders');
const ARCHIVE = process.argv.includes('--archive-existing');
const STORE_SLUG =
  process.argv.find((a) => a.startsWith('--store='))?.split('=')[1] ?? 'chilonzor-fashion';

// ── Baza qidiruvi ────────────────────────────────────────────────────────

async function lookup(): Promise<{
  storeId: string;
  brandId: string;
  categoryBySlug: Map<string, { id: string; slot: string | null }>;
}> {
  const { rows: stores } = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM stores WHERE slug = $1 AND status = 'active'`,
    [STORE_SLUG],
  );
  const store = stores[0];
  if (!store) throw new Error(`Do'kon topilmadi yoki faol emas: ${STORE_SLUG}`);

  /*
   * Brend ataylab «Local Brand»: render qilingan kiyimda hech qanday
   * logo yo'q. Unga Nike yoki Zara yopishtirilsa katalog haqiqatga
   * to'g'ri kelmaydigan narsa da'vo qilardi.
   */
  const { rows: brands } = await pool.query<{ id: string }>(
    `SELECT id FROM brands WHERE slug = 'local'`,
  );
  const brand = brands[0];
  if (!brand) throw new Error("«local» brendi topilmadi — dev_seed.sql qo'llanganmi?");

  const slugs = [...new Set(CATALOG.map((p) => p.categorySlug))];
  const { rows: categories } = await pool.query<{ slug: string; id: string; slot: string | null }>(
    `SELECT slug, id, slot FROM categories WHERE slug = ANY($1)`,
    [slugs],
  );

  const categoryBySlug = new Map(categories.map((c) => [c.slug, { id: c.id, slot: c.slot }]));
  const missing = slugs.filter((slug) => !categoryBySlug.has(slug));
  if (missing.length > 0) throw new Error(`Kategoriya topilmadi: ${missing.join(', ')}`);

  console.log(`Do'kon: ${store.name} (${STORE_SLUG})`);
  return { storeId: store.id, brandId: brand.id, categoryBySlug };
}

// ── Render ───────────────────────────────────────────────────────────────

interface RenderJob {
  key: string;
  file: string;
  slot: string;
  colorHex: string;
}

/**
 * Blender'ni bir marta chaqirib hamma rakursni chiqaradi.
 *
 * ⚠️ BIR CHAQIRUV, HAR BUYUMGA ALOHIDA EMAS. Blender'ning ishga tushishi
 * ~2 s, renderning o'zi ~1 s. Har variant uchun alohida jarayon
 * ochilsa, vaqtning uchdan ikkisi bo'sh yurishga ketardi.
 */
function render(jobs: RenderJob[], outDir: string): void {
  const spec = join(outDir, 'spec.json');
  writeFileSync(spec, JSON.stringify(jobs, null, 2));

  console.log(`\nRender: ${jobs.length} variant × 3 rakurs — Blender ishlayapti…`);
  execFileSync(
    BLENDER,
    ['--background', '--python', RENDERER, '--', '--spec', spec, '--out', outDir],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );

  const produced = readdirSync(outDir).filter((f) => f.endsWith('.png')).length;
  const expected = jobs.length * 3;
  if (produced < expected) {
    throw new Error(`Render to'liq emas: ${produced}/${expected} PNG`);
  }
  console.log(`  ✓ ${produced} ta surat`);
}

/**
 * PNG (shaffof) → fon qo'yilgan WEBP → R2.
 *
 * ⚠️ FON AYNAN SHU YERDA QO'YILADI. Render `film_transparent` bilan
 * chiqadi, chunki Blender'da olam rangi bir vaqtning o'zida ham fon,
 * ham yorug'lik manbayi bo'ladi — och fon kerak bo'lsa u sahnani
 * yoritib, kiyim rangini yuvib yuborardi.
 */
async function upload(pngPath: string): Promise<string> {
  const webp = await sharp(readFileSync(pngPath))
    .flatten({ background: BACKDROP })
    .webp({ quality: 82 })
    .toBuffer();

  // Kalit `presignUpload` bilan bir xil shaklda — panel yuklaganidan farq qilmasin
  return uploadObject({
    key: `product/${randomUUID()}.webp`,
    body: webp,
    contentType: 'image/webp',
  });
}

// ── Asosiy oqim ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { storeId, brandId, categoryBySlug } = await lookup();

  const variantCount = CATALOG.reduce((sum, p) => sum + p.variants.length, 0);
  console.log(`Katalog: ${CATALOG.length} mahsulot, ${variantCount} variant`);

  // Do'kondagi mavjud mahsulotlar — arxivlash yoki to'qnashuv nazorati uchun
  const { rows: present } = await pool.query<{ id: string; title: string }>(
    `SELECT id, title FROM products WHERE store_id = $1 AND status <> 'archived' ORDER BY created_at`,
    [storeId],
  );

  if (ARCHIVE && present.length > 0) {
    console.log(`\nArxivlanadi (${present.length} ta):`);
    for (const row of present) console.log(`  − ${row.title}`);
    if (APPLY) {
      // `archiveProduct` — panel va admin bilan bir xil yo'l: o'chirmaydi,
      // `archived` ga o'tkazadi (eski buyurtmalar mahsulotga bog'langan).
      for (const row of present) await archiveProduct(storeId, row.id);
      console.log('  ✓ arxivlandi');
    }
  } else {
    // Takroriy yurgizish nazorati — nomi bo'yicha
    const clash = present.filter((row) => CATALOG.some((p) => p.title === row.title));
    if (clash.length > 0) {
      throw new Error(
        `Bu mahsulotlar do'konda allaqachon bor: ${clash.map((r) => r.title).join(', ')}.\n` +
          `Ularni arxivlash uchun: --archive-existing`,
      );
    }
  }

  if (!APPLY) {
    console.log('\nQuruq yurish — hech narsa yozilmaydi. Bajarish uchun: --apply\n');
    for (const product of CATALOG) {
      const colors = product.variants.map((v) => v.color.uz).join(', ');
      console.log(
        `  ${product.title.padEnd(26)} ${product.basePrice.padStart(12)} UZS  [${colors}]`,
      );
    }
    return;
  }

  const outDir = mkdtempSync(join(tmpdir(), 'looksave-catalog-'));
  try {
    const jobs: RenderJob[] = [];
    for (const product of CATALOG) {
      const category = categoryBySlug.get(product.categorySlug);
      if (!category?.slot) throw new Error(`Kategoriyada slot yo'q: ${product.categorySlug}`);
      product.variants.forEach((variant, index) => {
        jobs.push({
          key: `${product.key}-${index}`,
          file: SHAPE_FILE[product.shape],
          slot: category.slot as string,
          colorHex: variant.hex,
        });
      });
    }

    render(jobs, outDir);

    console.log('\nR2 ga yuklash…');
    const imagesByKey = new Map<string, string[]>();
    for (const job of jobs) {
      const urls: string[] = [];
      for (const angle of [1, 2, 3]) {
        urls.push(await upload(join(outDir, `${job.key}-${angle}.png`)));
      }
      imagesByKey.set(job.key, urls);
      console.log(`  ✓ ${job.key}`);
    }

    console.log('\nMahsulot yaratish…');
    for (const product of CATALOG) {
      const category = categoryBySlug.get(product.categorySlug);

      const variants = product.variants.map((variant, index) => ({
        colorHex: variant.hex,
        colorName: variant.color,
        images: imagesByKey.get(`${product.key}-${index}`) ?? [],
        priceDelta: '0.00',
        sizes: variant.sizes,
      }));

      /*
       * ⚠️ MAHSULOT SURATI — BIRINCHI VARIANTNIKI. `from-photo.mjs`
       * rangni avval variant suratidan, bo'lmasa mahsulot suratidan
       * oladi. Ikkalasi ham to'ldirilgani uchun har variant O'Z rangida
       * 3D oladi, kartochka esa asosiy rangni ko'rsatadi.
       */
      const input = createProductSchema.parse({
        title: product.title,
        description: product.description,
        categoryId: category?.id,
        brandId,
        gender: product.gender,
        basePrice: product.basePrice,
        oldPrice: product.oldPrice,
        images: variants[0]?.images ?? [],
        tags: product.tags,
        isLimited: false,
        status: 'pending',
        variants,
        request3d: true,
      });

      const created = await createProduct(storeId, input);
      console.log(`  ✓ ${product.title.padEnd(26)} ${created.status}  ${created.id}`);
    }

    console.log(
      `\n✅ ${CATALOG.length} mahsulot yaratildi (status: pending).\n` +
        `   Keyingi qadam 1: 3D navbatini bo'shatish —\n` +
        `     node assets-3d/generator/worker-3d.mjs --once\n` +
        `   Keyingi qadam 2: admin panelda tasdiqlash (Moderatsiya) —\n` +
        `     tasdiqlanmaguncha katalogda ko'rinmaydi.`,
    );
  } finally {
    if (KEEP) console.log(`\nRenderlar saqlandi: ${outDir}`);
    else rmSync(outDir, { recursive: true, force: true });
    await pool.end();
  }
}

await main();
