/**
 * Eski qora fonli render'larga yangi cutout yozish (backfill).
 *
 * ⚠️ NIMA QILADI:
 *   - tryon_renders'da `cutout_url IS NULL` bo'lgan yoki
 *     `cutout_url = result_url` (ya'ni cutout o'tmagan) renderlarni topadi
 *   - Har biriga `makeCutout()` chaqirib yangi shaffof PNG yasaydi
 *   - cutout_url'ni yangi URL bilan yangilaydi
 *
 * ⚠️ XATOGA BARDOSHLI: bitta render yiqilsa boshqalari davom etadi.
 *   Yiqilgan render'lar logga yoziladi.
 *
 * ISHGA TUSHIRISH (VPS):
 *   cd apps/api
 *   /var/www/LookSave/node_modules/.bin/tsx --env-file=.env scripts/backfill-cutouts.ts --count
 *   # agar sonlar to'g'ri bo'lsa:
 *   /var/www/LookSave/node_modules/.bin/tsx --env-file=.env scripts/backfill-cutouts.ts --execute
 */

import { pool } from '../src/db/pool';
import { makeCutout } from '../src/store/cutout';
import { logger } from '../src/logger';

const DRY_RUN = !process.argv.includes('--execute');
const LIMIT = Number(process.env.LIMIT ?? '200');

async function main(): Promise<void> {
  logger.info({ dryRun: DRY_RUN, limit: LIMIT }, 'backfill boshlanmoqda');

  const { rows } = await pool.query<{ id: string; result_url: string; cutout_url: string | null }>(
    `SELECT id, result_url, cutout_url
       FROM tryon_renders
      WHERE status = 'ready'
        AND result_url IS NOT NULL
        AND (cutout_url IS NULL OR cutout_url = result_url)
      ORDER BY completed_at DESC
      LIMIT $1`,
    [LIMIT],
  );

  console.log(`\nTopildi: ${rows.length} ta eski render (cutout yo'q yoki result = cutout).`);

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN — hech narsa yangilanmadi.');
    console.log('   --execute bilan qayta ishga tushiring.');
    console.log('\nBirinchi 5 ta:');
    for (const r of rows.slice(0, 5)) {
      console.log(`  ${r.id.slice(0, 8)} → ${r.result_url.slice(0, 70)}`);
    }
    await pool.end();
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const [i, row] of rows.entries()) {
    try {
      const cutout = await makeCutout(row.result_url, 'tryon');
      if (!cutout) {
        console.log(`[${i + 1}/${rows.length}] ${row.id.slice(0, 8)} — cutout null, o'tkazildi`);
        fail++;
        continue;
      }
      await pool.query(
        `UPDATE tryon_renders SET cutout_url = $2 WHERE id = $1 AND result_url = $3`,
        [row.id, cutout, row.result_url],
      );
      ok++;
      console.log(`[${i + 1}/${rows.length}] ${row.id.slice(0, 8)} ✓`);
    } catch (err) {
      fail++;
      logger.warn({ err, id: row.id }, 'backfill render yiqildi');
      console.log(`[${i + 1}/${rows.length}] ${row.id.slice(0, 8)} ✗ ${(err as Error).message}`);
    }
  }

  console.log(`\n✓ Tugadi. ${ok} yangilandi, ${fail} xato.`);
  await pool.end();
}

main().catch((err) => {
  logger.error({ err }, 'backfill yiqildi');
  process.exit(1);
});
