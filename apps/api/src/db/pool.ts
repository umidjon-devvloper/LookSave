import pg from 'pg';

import { env } from '../config/env';
import { logger } from '../logger';

/**
 * NUMERIC (OID 1700) — pg standart holatda string qaytaradi va shunday qolishi kerak.
 * `parseFloat` qilinsa pul aniqligi yo'qoladi (docs/02-database.md §1).
 * BIGINT (OID 20) ham string — `telegram_chat_id` xavfsiz saqlanadi.
 * Bu yerda hech qanday `setTypeParser` chaqirilmaydi — atayin.
 */

export const pool = new pg.Pool({
  connectionString: env().DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  application_name: 'looksave-api',
});

pool.on('error', (err) => {
  // Bo'sh turgan ulanish uzilsa — pool o'zi tiklaydi, lekin log kerak
  logger.error({ err }, 'postgres pool xatosi');
});

export async function pingDb(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (err) {
    logger.warn({ err }, 'postgres javob bermadi');
    return false;
  }
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
