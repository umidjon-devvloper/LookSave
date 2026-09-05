import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';
import sharp from 'sharp';

import { closeFaceDetector, faceMorphs } from './lib/faceShape.mjs';

/**
 * Selfidan avatar YUZINI shaxsiylashtiradi (12-tz.md, "yuz" ishi).
 *
 *   node assets-3d/generator/analyze-face.mjs            # rejani ko'rsatadi
 *   node assets-3d/generator/analyze-face.mjs --apply    # bajaradi
 *
 * ⚠️ NEGA WORKER'DA, API'DA EMAS. Rasmni tahlil qilish `sharp` (native)
 * talab qiladi. Uni API imijiga qo'shsak, u har so'rovda shu yukni
 * ko'tarardi. Worker mustaqil ishlaydi va rasm ishlashini bir joyга
 * jamlaydi (`from-photo.mjs` ham shu yerda).
 *
 * ⚠️ HOZIRCHA FAQAT TERI RANGI. Yuz SHAKLI morflari (`fm_*`) yuz
 * nuqtalarini (landmark) talab qiladi. Hermes'da WebAssembly yo'q
 * (04-3d-pipeline §0), shuning uchun MediaPipe qurilmada ishlamaydi va
 * landmark aniqlash alohida qaror: server tfjs (@vladmandic/human) yoki
 * native ML Kit. U tayyor bo'lgunicha yuz shakli neytral, teri rangi esa
 * darhol ishlaydi — eng ko'zga tashlanadigan shaxsiylashtirish.
 *
 * Teri rangi bosh/bo'yin/qo'l materialiga tushadi (`AvatarView`), ya'ni
 * avatar foydalanuvchining teri rangida ko'rinadi.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(ROOT, '..');
const APPLY = process.argv.includes('--apply');

const apiEnv = readFileSync(join(REPO, 'apps/api/.env'), 'utf8');
const env = (key) => apiEnv.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1].trim();

/**
 * Yuz suratining markazidan teri rangini oladi.
 *
 * ⚠️ MARKAZ — BURUN/YONOQ SOHASI. Selfida yuz ramka o'rtasida turadi
 * (FaceStep "yuzingizni ramka ichiga joylang" deydi), markazda esa burun
 * va yonoq — sof teri. Ko'z, soch, fon chetda qoladi.
 *
 * ⚠️ JUDA OCH VA JUDA TO'Q PIKSEL TASHLANADI: yorug'lik dog'i (oq) va
 * ko'z/burun teshigi (qora) teri rangini buzadi.
 */
async function skinTone(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`surat yuklanmadi: HTTP ${response.status}`);

  const bytes = Buffer.from(await response.arrayBuffer());
  const image = sharp(bytes).rotate().removeAlpha(); // `rotate()` — EXIF burilishini qo'llaydi
  const meta = await image.metadata();
  const { width, height } = meta;

  // Markazning 40% i — yonoq/burun sohasi
  const side = Math.max(8, Math.round(Math.min(width, height) * 0.4));
  const { data } = await image
    .extract({
      left: Math.round((width - side) / 2),
      top: Math.round((height - side) / 2),
      width: side,
      height: side,
    })
    .resize(32, 32, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let r = 0;
  let g = 0;
  let b = 0;
  let counted = 0;

  for (let i = 0; i < data.length; i += 3) {
    const [pr, pg_, pb] = [data[i], data[i + 1], data[i + 2]];
    const light = (pr + pg_ + pb) / 3;
    if (light > 235 || light < 25) continue;

    /*
     * ⚠️ TERI FILTRI. Markazda ko'z yoki soch bo'lsa ular teri emas. Teri
     * rangi issiq tomonga og'adi: qizil > yashil > ko'k. Bu shartga
     * to'g'ri kelmagan piksel (masalan ko'k fon yoki qizil labdan
     * boshqa) tashlanadi — natija tabiiy teri tusiga yaqinlashadi.
     */
    if (!(pr >= pg_ && pg_ >= pb)) continue;

    r += pr;
    g += pg_;
    b += pb;
    counted += 1;
  }

  if (counted === 0) return null; // Ishonchli teri pikseli topilmadi

  const to = (value) => Math.round(value / counted);
  const hex = (value) => value.toString(16).padStart(2, '0');
  return `#${hex(to(r))}${hex(to(g))}${hex(to(b))}`.toUpperCase();
}

const pool = new pg.Pool({ connectionString: env('DATABASE_URL') });

const { rows } = await pool.query(
  `SELECT p.user_id, p.face_texture_url, (p.skin_tone IS NULL) AS need_tone,
          (p.face_morphs IS NULL) AS need_shape
     FROM profiles p
    WHERE p.face_texture_url IS NOT NULL
      AND (p.skin_tone IS NULL OR p.face_morphs IS NULL)`,
);

if (rows.length === 0) {
  console.log('Tahlil qilinadigan yangi selfi yo`q.');
  await pool.end();
  process.exit(0);
}

console.log(`${rows.length} ta selfi${APPLY ? '' : '  (quruq yurish)'}\n`);

let done = 0;
let failed = 0;

for (const row of rows) {
  try {
    const who = row.user_id.slice(0, 8);
    const tone = row.need_tone ? await skinTone(row.face_texture_url) : null;

    /*
     * ⚠️ SHAKL TERI RANGIDAN MUSTAQIL. Qorong'i selfida yuz nuqtalari
     * topilmasligi mumkin, teri rangi esa baribir chiqadi — va aksincha.
     * Shuning uchun ikkalasi alohida yoziladi: biri bo'lmasa ikkinchisi
     * yo'qolmaydi.
     */
    const shape = row.need_shape ? await faceMorphs(row.face_texture_url) : null;

    if (!tone && !shape) {
      console.log(`  ⚠️ ${who}: na teri rangi, na yuz nuqtalari topildi`);
      continue;
    }

    const parts = [];
    if (tone) parts.push(`teri ${tone}`);
    if (shape) parts.push(`shakl (${Object.keys(shape).length} morf)`);
    console.log(`  ${APPLY ? '↑' : '·'} ${who} → ${parts.join(' · ')}`);

    if (APPLY) {
      if (tone) {
        await pool.query(`UPDATE profiles SET skin_tone = $2 WHERE user_id = $1`, [
          row.user_id,
          tone,
        ]);
      }
      if (shape) {
        await pool.query(`UPDATE profiles SET face_morphs = $2::jsonb WHERE user_id = $1`, [
          row.user_id,
          JSON.stringify(shape),
        ]);
      }
    }
    done += 1;
  } catch (error) {
    failed += 1;
    console.log(`  ✗ ${row.user_id.slice(0, 8)}: ${error.message}`);
  }
}

closeFaceDetector();
await pool.end();
console.log(
  `\n${APPLY ? '✅' : 'Reja:'} ${done} ta profil${failed ? `, ${failed} ta xato` : ''}` +
    (APPLY ? '' : '\nBajarish: node assets-3d/generator/analyze-face.mjs --apply'),
);
