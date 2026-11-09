/**
 * Developer AI panelidagi arxiv tasklarni va bog'liq fayllarni tozalash.
 *
 * ⚠️ NIMA O'CHIRILADI:
 *   - developer_ai_tasks WHERE status IN ('done','failed','expired')
 *   - Ularga bog'liq tryon_renders (kind='render' bo'lsa, ref_id orqali)
 *   - R2'dagi barcha bog'liq fayllar: result_url, cutout_url, angle sheet'lari
 *
 * ⚠️ NIMA QOLADI:
 *   - pending / claimed tasklar (navbatda ishlab turgani)
 *   - Avatar fayllari (profiles.avatar_image_url) — ular ko'p marta
 *     qayta ishlatiladi, cleanup'da tegilmaydi
 *
 * ISHGA TUSHIRISH (VPS):
 *   cd /var/www/LookSave/apps/api
 *   tsx --env-file=.env scripts/cleanup-developer-ai.ts --count
 *   # agar sonlar to'g'ri bo'lsa:
 *   tsx --env-file=.env scripts/cleanup-developer-ai.ts --execute
 *
 * ⚠️ --execute YOZILMAGUNICHA hech narsa o'chirilmaydi — avval ko'rsatadi.
 */

import { pool } from '../src/db/pool';
import { deleteByUrl } from '../src/integrations/r2';
import { logger } from '../src/logger';

const DRY_RUN = !process.argv.includes('--execute');

async function main(): Promise<void> {
  logger.info({ dryRun: DRY_RUN }, 'cleanup boshlanmoqda');

  // 1. Qancha task o'chiriladi — ko'rsatish
  const taskCount = await pool.query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text AS count
       FROM developer_ai_tasks
      WHERE status IN ('done', 'failed', 'expired')
      GROUP BY status
      ORDER BY status`,
  );
  console.log('\nO\'chiriladigan tasklar (status bo\'yicha):');
  for (const row of taskCount.rows) console.log(`  ${row.status}: ${row.count}`);

  // 2. Bog'liq tryon_renders va ularning URL'lari
  const renders = await pool.query<{
    id: string;
    result_url: string | null;
    cutout_url: string | null;
    angles: Record<string, string> | null;
  }>(
    `SELECT r.id, r.result_url, r.cutout_url, r.angles
       FROM tryon_renders r
       JOIN developer_ai_tasks t
         ON t.kind = 'render' AND t.ref_id = r.id
      WHERE t.status IN ('done', 'failed', 'expired')`,
  );
  console.log(`\nO'chiriladigan tryon_renders: ${renders.rowCount}`);

  // 3. R2'dagi fayllarni to'plash
  const urls = new Set<string>();
  for (const row of renders.rows) {
    if (row.result_url) urls.add(row.result_url);
    if (row.cutout_url) urls.add(row.cutout_url);
    if (row.angles) {
      for (const u of Object.values(row.angles)) {
        if (u) urls.add(u);
      }
    }
  }
  console.log(`O'chiriladigan R2 fayllari: ${urls.size}`);

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN — hech narsa o\'chirilmadi.');
    console.log('   --execute flag bilan qayta ishlating.');
    await pool.end();
    return;
  }

  // 4. R2'ni tozalash (parallel 10 ta)
  console.log('\nR2 tozalanmoqda...');
  const urlList = [...urls];
  let r2Done = 0;
  let r2Fail = 0;
  const batchSize = 10;
  for (let i = 0; i < urlList.length; i += batchSize) {
    const batch = urlList.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (url) => {
        try {
          await deleteByUrl(url);
          r2Done++;
        } catch (err) {
          r2Fail++;
          logger.warn({ err, url }, 'R2 o\'chirishda xato');
        }
      }),
    );
    if ((i + batchSize) % 100 === 0 || i + batchSize >= urlList.length) {
      process.stdout.write(`\r  R2: ${r2Done} ✓  ${r2Fail} ✗  / ${urlList.length}`);
    }
  }
  console.log(`\n  R2 tugadi: ${r2Done} o'chirildi, ${r2Fail} xato.`);

  // 5. DB'ni tozalash — tryon_renders birinchi, keyin tasklar
  console.log('\nDB tozalanmoqda...');
  const renderIds = renders.rows.map((r) => r.id);
  if (renderIds.length > 0) {
    const del = await pool.query('DELETE FROM tryon_renders WHERE id = ANY($1::uuid[])', [renderIds]);
    console.log(`  tryon_renders: ${del.rowCount} o'chirildi`);
  }
  const taskDel = await pool.query(
    `DELETE FROM developer_ai_tasks WHERE status IN ('done', 'failed', 'expired')`,
  );
  console.log(`  developer_ai_tasks: ${taskDel.rowCount} o'chirildi`);

  console.log('\n✓ Tozalash tugadi.');
  await pool.end();
}

main().catch((err) => {
  logger.error({ err }, 'cleanup yiqildi');
  process.exit(1);
});
