/**
 * Yo'l-yo'l (buzuq) kesimlarni topib, qayta yasash.
 *
 * ⚠️ NIMA BO'LGAN. 2026-11-09 … 11-13 orasida kesim xizmati (fly.io) javob
 * bermagan paytda yasalgan HAR kesim buzuq chiqqan: har uch qatordan
 * ikkitasi shaffof, figura o'rnida fon (`src/store/cutout.ts` →
 * `refineAlpha` izohi). Fayllar omborda qolgan va `cutout_url` ularga
 * ishora qilib turibdi — ilova ularni ko'rsataveradi. Bazada buzuq kesimni
 * sog'lomidan ajratadigan belgi yo'q, farq faqat piksellarda.
 *
 * ⚠️ NIMA QILADI:
 *   1. Kesimi bor kiyintirish natijalari va avatarlarni aylanib chiqadi.
 *      Fayl 2026-11-08 dan OLDIN yuklangan bo'lsa (ombor sarlavhasi) —
 *      o'tkazib yuboradi; qolganini yuklab olib, piksel bo'yicha tekshiradi
 *      (`isStripedCutout`). Sog'lom kesimga TEGILMAYDI.
 *   2. `--execute` bilan: har buzuq kesim o'rniga yangisini yasaydi
 *      (`makeCutout`). Yasab bo'lmasa `cutout_url` bo'shatiladi — ilova
 *      bunda oddiy suratni ko'rsatadi, bu yo'l-yo'l arvohdan yaxshi.
 *   3. O'sha buzuq faylga ishora qilgan saqlangan komplekt muqovalari
 *      (`looks.thumbnail_url`) ham yangilanadi.
 *
 * Buzuq fayllarning O'ZI ombordan o'chirilmaydi — ularga hech narsa ishora
 * qilmay qoladi.
 *
 * ⚠️ XIZMATGA YUK. Asl surati shaffof bo'lmagan har buzuq kesim uchun kesim
 * xizmatiga bitta so'rov ketadi (bittalab, ketma-ket). Operatorlar faol
 * ishlamayotgan paytda yurgizgan ma'qul.
 *
 * ISHGA TUSHIRISH (VPS) — avval faqat ro'yxat, hech narsa o'zgarmaydi:
 *   cd apps/api
 *   /var/www/LookSave/node_modules/.bin/tsx --env-file=.env scripts/repair-striped-cutouts.ts
 *   # ro'yxat to'g'ri bo'lsa:
 *   /var/www/LookSave/node_modules/.bin/tsx --env-file=.env scripts/repair-striped-cutouts.ts --execute
 *
 * Sozlamalar (muhit o'zgaruvchisi): SINCE=2026-11-08 — shu kundan oldin
 * yuklangan fayllar tekshirilmaydi; LIMIT=20000 — har jadvaldan nechta qator.
 */

import { pool } from '../src/db/pool';
import { logger } from '../src/logger';
import { makeCutout } from '../src/store/cutout';
import { isStripedCutout } from '../src/store/cutout-damage';

const EXECUTE = process.argv.includes('--execute');
const SINCE = new Date(process.env.SINCE ?? '2026-11-08T00:00:00Z');
const LIMIT = Number(process.env.LIMIT ?? '20000');

interface Target {
  kind: 'render' | 'avatar';
  /** `tryon_renders.id` yoki `profiles.user_id` */
  id: string;
  sourceUrl: string;
  cutoutUrl: string;
}

type Verdict = 'striped' | 'clean' | 'old' | 'unreadable';

/**
 * Kesim faylini tekshiradi.
 *
 * ⚠️ ESKI FAYL YUKLAB OLINMAYDI. Ombor har faylning yuklangan vaqtini
 * `Last-Modified` da beradi; nuqson paydo bo'lishidan oldin yuklangan fayl
 * buzuq bo'lishi mumkin emas — tanasi o'qilmasdan o'tkaziladi. Sarlavha
 * bo'lmasa fayl baribir tekshiriladi.
 */
async function inspect(url: string): Promise<Verdict> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) return 'unreadable';

    const modified = response.headers.get('last-modified');
    if (modified && new Date(modified) < SINCE) {
      await response.body?.cancel();
      return 'old';
    }

    const body = Buffer.from(await response.arrayBuffer());
    return (await isStripedCutout(body)) ? 'striped' : 'clean';
  } catch {
    return 'unreadable';
  }
}

async function loadTargets(): Promise<Target[]> {
  const renders = await pool.query<{ id: string; result_url: string; cutout_url: string }>(
    `SELECT id, result_url, cutout_url
       FROM tryon_renders
      WHERE status = 'ready'
        AND result_url IS NOT NULL
        AND cutout_url IS NOT NULL
        AND cutout_url <> result_url
      ORDER BY COALESCE(completed_at, created_at) DESC
      LIMIT $1`,
    [LIMIT],
  );

  const avatars = await pool.query<{
    user_id: string;
    avatar_image_url: string;
    avatar_cutout_url: string;
  }>(
    `SELECT user_id, avatar_image_url, avatar_cutout_url
       FROM profiles
      WHERE avatar_image_url IS NOT NULL
        AND avatar_cutout_url IS NOT NULL
        AND avatar_cutout_url <> avatar_image_url
      ORDER BY avatar_updated_at DESC NULLS LAST
      LIMIT $1`,
    [LIMIT],
  );

  return [
    ...renders.rows.map((row): Target => ({
      kind: 'render',
      id: row.id,
      sourceUrl: row.result_url,
      cutoutUrl: row.cutout_url,
    })),
    ...avatars.rows.map((row): Target => ({
      kind: 'avatar',
      id: row.user_id,
      sourceUrl: row.avatar_image_url,
      cutoutUrl: row.avatar_cutout_url,
    })),
  ];
}

/**
 * Yangi kesim. `null` — yasab bo'lmadi.
 *
 * ⚠️ NATIJA HAM TEKSHIRILADI. Yangi kesim ham yo'l-yo'l chiqsa (masalan
 * skript tuzatilmagan kod bilan yurgizilgan) — u yozilmaydi: bir buzuq
 * faylni ikkinchisiga almashtirishdan foyda yo'q.
 */
async function remake(target: Target): Promise<string | null> {
  const fresh = await makeCutout(target.sourceUrl, target.kind === 'avatar' ? 'avatar' : 'tryon');
  if (!fresh) return null;

  // Asl suratning o'zi qaytdi — u allaqachon kesilgan, tekshiradigan yangi fayl yo'q
  if (fresh === target.sourceUrl) return fresh;

  return (await inspect(fresh)) === 'striped' ? null : fresh;
}

/** Buzuq faylga ishora qilgan HAMMA joyni yangi manzilga o'tkazadi. */
async function repoint(target: Target, next: string | null): Promise<void> {
  if (target.kind === 'render') {
    await pool.query(`UPDATE tryon_renders SET cutout_url = $2 WHERE cutout_url = $1`, [
      target.cutoutUrl,
      next,
    ]);
  } else {
    await pool.query(
      `UPDATE profiles SET avatar_cutout_url = $3
        WHERE user_id = $1 AND avatar_cutout_url = $2`,
      [target.id, target.cutoutUrl, next],
    );
  }

  // Muqova bo'sh qolmasin: kesim yasalmagan bo'lsa asl surat qo'yiladi
  await pool.query(`UPDATE looks SET thumbnail_url = $2 WHERE thumbnail_url = $1`, [
    target.cutoutUrl,
    next ?? target.sourceUrl,
  ]);
}

async function main(): Promise<void> {
  const targets = await loadTargets();
  console.log(
    `\nKesimi bor yozuvlar: ${targets.length} ta. ${SINCE.toISOString().slice(0, 10)} dan beri yuklangan fayllar tekshiriladi…`,
  );

  const verdicts = new Map<string, Verdict>();
  const counts: Record<Verdict, number> = { striped: 0, clean: 0, old: 0, unreadable: 0 };
  const broken: Target[] = [];

  for (const [index, target] of targets.entries()) {
    let verdict = verdicts.get(target.cutoutUrl);
    if (!verdict) {
      verdict = await inspect(target.cutoutUrl);
      verdicts.set(target.cutoutUrl, verdict);
    }

    counts[verdict] += 1;
    if (verdict === 'striped') broken.push(target);
    if ((index + 1) % 100 === 0) console.log(`  …${index + 1}/${targets.length}`);
  }

  console.log(
    `\nBuzuq: ${counts.striped} · sog'lom: ${counts.clean} · eski (tekshirilmadi): ${counts.old} · o'qilmadi: ${counts.unreadable}`,
  );
  for (const target of broken) {
    console.log(`  ${target.kind.padEnd(6)} ${target.id}  ${target.cutoutUrl}`);
  }

  if (broken.length === 0 || !EXECUTE) {
    if (broken.length > 0) {
      console.log('\n⚠️  FAQAT RO`YXAT — hech narsa o`zgarmadi. Tuzatish uchun: --execute');
    }
    await pool.end();
    return;
  }

  let remade = 0;
  let cleared = 0;
  const done = new Set<string>();

  for (const [index, target] of broken.entries()) {
    const label = `[${index + 1}/${broken.length}] ${target.kind} ${target.id.slice(0, 8)}`;

    // Bitta buzuq faylga bir necha yozuv ishora qilishi mumkin — `repoint` hammasini yopgan
    if (done.has(target.cutoutUrl)) {
      console.log(`${label} — yuqorida tuzatilgan`);
      continue;
    }
    done.add(target.cutoutUrl);

    try {
      const next = await remake(target);
      await repoint(target, next);

      if (next) {
        remade += 1;
        console.log(`${label} ✓ ${next === target.sourceUrl ? 'asl surat o`zi kesim' : next}`);
      } else {
        cleared += 1;
        console.log(`${label} — yangi kesim yasalmadi, kesim bo'shatildi (oddiy surat ko'rinadi)`);
      }
    } catch (err) {
      logger.warn({ err, id: target.id }, 'kesimni tuzatib bo`lmadi');
      console.log(`${label} ✗ ${(err as Error).message}`);
    }
  }

  console.log(`\n✓ Tugadi. Qayta yasaldi: ${remade}, bo'shatildi: ${cleared}.`);
  await pool.end();
}

main().catch((err) => {
  logger.error({ err }, 'kesimlarni tuzatish yiqildi');
  process.exit(1);
});
