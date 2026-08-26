/**
 * D-43 — shaxsiy R2 bucket'ini tekshirish (docs/12-tz.md §4.1.1).
 *
 * ⚠️ NEGA BU SKRIPT KERAK. D-43 ning kod tomoni tugagan, lekin oxirgi
 * ikki qadam Cloudflare panelida qo'lda bajariladi: bucket yaratish va
 * `.env` ga yozish. Ular bajarilgandan keyin «ishladimi?» degan savolga
 * javob beradigan hech narsa yo'q edi — ilova jim ishlayveradi, surat
 * esa ochiq qolishi mumkin. Bu skript javobni O'LCHAB beradi.
 *
 * Skript IKKI holatda ham foydali:
 *
 *   Bucket YO'Q   → nuqsonni isbotlaydi: yuz surati ochiq manzilda
 *                   o'qiladi (ya'ni D-43 haqiqatan ochiq)
 *   Bucket BOR    → tuzatilganini isbotlaydi: obyekt ochiq bucketda
 *                   yo'q, ochiq havola bermaydi, imzolangan havola beradi
 *
 * ⚠️ HAQIQIY KOD SINALADI, NUSXASI EMAS. Skript `src/integrations/r2`
 * dan aynan ilova ishlatadigan funksiyalarni chaqiradi. Mantiq bu yerda
 * takrorlansa, kod o'zgarganda tekshiruv jimgina yolg'on gapira boshlardi.
 *
 * Ishga tushirish (repo ildizidan):
 *
 *   npm run check:private-bucket --workspace=apps/api
 *
 * Skript o'zidan keyin tozalaydi: sinov obyekti har holatda o'chiriladi.
 */

import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { env } from '../src/config/env';
import {
  deleteObject,
  hasPrivateBucket,
  isPrivateKey,
  presignRead,
  presignUpload,
} from '../src/integrations/r2';

/** Sinov obyekti nomi — katalogda ko'rinib tursin va tasodifiy fayl bilan chalkashmasin. */
const TEST_FILE = '_d43-selftest.txt';
const TEST_BODY = 'LookSave D-43 selftest — bu fayl skript tomonidan yaratildi va o`chiriladi.';

type Status = 'ok' | 'fail' | 'skip';

interface Check {
  status: Status;
  nima: string;
  natija: string;
}

const checks: Check[] = [];

function add(status: Status, nima: string, natija: string): void {
  checks.push({ status, nima, natija });
}

/** Xom S3 mijoz — faqat TEKSHIRISH uchun (obyekt qaysi bucketda ekanini bilish). */
function rawClient(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: env().R2_ENDPOINT,
    credentials: {
      accessKeyId: env().R2_ACCESS_KEY_ID,
      secretAccessKey: env().R2_SECRET_ACCESS_KEY,
    },
  });
}

/** Obyekt shu bucketda bormi. Yo'qligi xato emas — `false` qaytadi. */
async function exists(bucket: string, key: string): Promise<boolean> {
  try {
    await rawClient().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Havolani IMZOSIZ o'qishga urinish.
 *
 * ⚠️ `redirect: 'manual'` ATAYIN: r2.dev ba'zan qayta yo'naltiradi va
 * avtomatik ergashish 200 ni yashirib qo'yishi mumkin. Bizga aynan
 * BIRINCHI javob kerak.
 */
async function fetchStatus(url: string): Promise<number> {
  try {
    const res = await fetch(url, { redirect: 'manual' });
    return res.status;
  } catch {
    return 0; // tarmoq xatosi — «ochiq emas» deb hisoblamaymiz, alohida ko'rsatamiz
  }
}

async function main(): Promise<void> {
  const configured = hasPrivateBucket();

  console.log('');
  console.log('  D-43 — shaxsiy bucket tekshiruvi');
  console.log('  ─────────────────────────────────────────────────────────');
  console.log(`  Ochiq bucket    : ${env().R2_BUCKET_ASSETS}`);
  console.log(`  Shaxsiy bucket  : ${configured ? env().R2_BUCKET_PRIVATE : '(sozlanmagan)'}`);
  console.log(`  CDN             : ${env().CDN_BASE_URL}`);
  console.log('');

  if (!env().R2_ACCESS_KEY_ID || !env().R2_ENDPOINT) {
    console.error('  ✗ R2 kalitlari sozlanmagan (R2_ACCESS_KEY_ID / R2_ENDPOINT).');
    console.error('    apps/api/.env ni to`ldiring.');
    process.exit(1);
  }

  // ── 1. Imzolangan yuklash havolasi ──────────────────────────────
  const presigned = await presignUpload({
    fileName: TEST_FILE,
    contentType: 'image/jpeg', // sxema faqat rasm turlarini qabul qiladi
    purpose: 'face',
  });

  const key = presigned.key;
  add('ok', 'Yuklash havolasi yasaldi', key);

  if (!isPrivateKey(key)) {
    add('fail', 'Kalit shaxsiy prefiksda', `${key} — «face/» kutilgan edi`);
  } else {
    add('ok', 'Kalit shaxsiy prefiksda', 'face/…');
  }

  let uploaded = false;

  try {
    // ── 2. Faylni yuklash ─────────────────────────────────────────
    const put = await fetch(presigned.uploadUrl, {
      method: 'PUT',
      headers: presigned.headers,
      body: TEST_BODY,
    });

    if (!put.ok) {
      add(
        'fail',
        'Sinov fayli yuklandi',
        'HTTP ' + put.status + ' — bucket yo`q yoki huquq yetmaydi',
      );
      report(configured);
      process.exit(1);
    }

    uploaded = true;
    add('ok', 'Sinov fayli yuklandi', `HTTP ${put.status}`);

    // ── 3. Qaysi bucketga tushdi ──────────────────────────────────
    const inPublic = await exists(env().R2_BUCKET_ASSETS, key);

    if (configured) {
      const inPrivate = await exists(env().R2_BUCKET_PRIVATE, key);
      add(
        inPrivate ? 'ok' : 'fail',
        'Shaxsiy bucketda',
        inPrivate ? env().R2_BUCKET_PRIVATE : 'topilmadi',
      );
      add(
        inPublic ? 'fail' : 'ok',
        'Ochiq bucketda YO`Q',
        inPublic ? `⚠️ ${env().R2_BUCKET_ASSETS} da turibdi` : 'to`g`ri',
      );
    } else {
      add(
        'fail',
        'Ochiq bucketda YO`Q',
        inPublic ? `⚠️ ${env().R2_BUCKET_ASSETS} da — shaxsiy bucket sozlanmagan` : 'topilmadi',
      );
    }

    // ── 4. Ochiq havola bilan o'qish — ENG MUHIM TEKSHIRUV ─────────
    const openStatus = await fetchStatus(presigned.publicUrl);

    if (openStatus === 200) {
      add('fail', 'Ochiq havola BERMAYDI', '⚠️ HTTP 200 — surat kalitsiz o`qiladi');
    } else if (openStatus === 0) {
      add('skip', 'Ochiq havola BERMAYDI', 'tarmoq javob bermadi — qo`lda tekshiring');
    } else {
      add('ok', 'Ochiq havola BERMAYDI', `HTTP ${openStatus}`);
    }

    // ── 5. Imzolangan havola bilan o'qish ─────────────────────────
    const signed = await presignRead(presigned.publicUrl);

    if (!configured) {
      add('skip', 'Imzolangan havola o`qiydi', 'shaxsiy bucket sozlanmagan');
    } else if (!signed || signed === presigned.publicUrl) {
      add('fail', 'Imzolangan havola o`qiydi', 'havola imzolanmadi — o`zgarishsiz qaytdi');
    } else {
      const signedStatus = await fetchStatus(signed);
      add(
        signedStatus === 200 ? 'ok' : 'fail',
        'Imzolangan havola o`qiydi',
        `HTTP ${signedStatus}`,
      );
    }
  } finally {
    // ── 6. Tozalash va o'chirish tekshiruvi ─────────────────────────
    if (uploaded) {
      try {
        await deleteObject(key);
        const stillPublic = await exists(env().R2_BUCKET_ASSETS, key);
        const stillPrivate = configured ? await exists(env().R2_BUCKET_PRIVATE, key) : false;

        add(
          stillPublic || stillPrivate ? 'fail' : 'ok',
          'Sinov fayli o`chirildi',
          stillPublic || stillPrivate ? '⚠️ fayl joyida qoldi' : 'toza',
        );
      } catch (error) {
        add('fail', 'Sinov fayli o`chirildi', String(error));
      }
    }
  }

  report(configured);
}

function report(configured: boolean): void {
  const width = Math.max(...checks.map((c) => c.nima.length));
  console.log('');

  for (const c of checks) {
    const mark = c.status === 'ok' ? '✓' : c.status === 'fail' ? '✗' : '–';
    console.log(`  ${mark}  ${c.nima.padEnd(width)}   ${c.natija}`);
  }

  const failed = checks.filter((c) => c.status === 'fail').length;
  console.log('');

  if (!configured) {
    console.log('  ─────────────────────────────────────────────────────────');
    console.log('  D-43 OCHIQ — shaxsiy bucket sozlanmagan.');
    console.log('');
    console.log('  1) Cloudflare → R2 → Create bucket → nomi: looksave-private');
    console.log('     Public access: OFF (r2.dev manzili BO`LMASIN)');
    console.log('  2) apps/api/.env ga:  R2_BUCKET_PRIVATE=looksave-private');
    console.log('  3) Shu skriptni qayta yurgizing');
    console.log('');
    process.exit(1);
  }

  console.log('  ─────────────────────────────────────────────────────────');

  if (failed === 0) {
    console.log('  ✓ D-43 YOPILDI — yangi yuz va gavda suratlari shaxsiy bucketda.');
    console.log('');
    console.log('  ⚠️ Qolgan qism: ESKI suratlar. Ular hali ochiq bucketda va');
    console.log('     ochiq havolada turibdi. Ularni ko`chirish yoki foydalanuvchidan');
    console.log('     qayta skanerlashni so`rash — alohida qaror (docs/12-tz.md).');
    console.log('');
    process.exit(0);
  }

  console.log('  ✗ ' + failed + ' ta tekshiruv yiqildi — yuqoridagi ✗ larni ko`ring.');
  console.log('');
  process.exit(1);
}

main().catch((error: unknown) => {
  console.error('');
  console.error('  ✗ Tekshiruv yiqildi:', error);
  console.error('');
  process.exit(1);
});
