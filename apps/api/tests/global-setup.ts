import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import pg from 'pg';

/**
 * Integratsion testlar uchun toza baza tayyorlaydi.
 *
 * Nima uchun: birlik testlari sxemalarni tekshiradi, lekin haqiqiy
 * xatolar odatda SQL'da, tranzaksiyalarda va triggerlarda chiqadi.
 * Bu testlar `curl` bilan qo'lda tekshirganlarimni takrorlanadigan
 * qiladi va CI'da har PR'da ishlaydi.
 *
 * Baza har safar noldan quriladi: migratsiyalar shu yerda ham
 * tekshiriladi — ular buzilgan bo'lsa testlar boshlanmaydi.
 */

const MIGRATIONS_DIR = join(process.cwd(), '../../infra/migrations');

function adminUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.pathname = '/postgres';
  return url.toString();
}

function databaseName(databaseUrl: string): string {
  return new URL(databaseUrl).pathname.replace(/^\//, '');
}

/**
 * `test.env` faqat test jarayonlariga qo'llanadi — globalSetup asosiy
 * jarayonda ishlaydi va uni ko'rmaydi. Shuning uchun manzil shu yerda
 * qayta hisoblanadi; qiymat `vitest.integration.config.ts` bilan bir xil.
 */
export function testDatabaseUrl(): string {
  return (
    process.env['TEST_DATABASE_URL'] ?? 'postgres://looksave:looksave@localhost:5432/looksave_it'
  );
}

export async function setup(): Promise<void> {
  const databaseUrl = testDatabaseUrl();

  const name = databaseName(databaseUrl);
  const admin = new pg.Client({ connectionString: adminUrl(databaseUrl) });

  await admin.connect();
  // `WITH (FORCE)` — oldingi test ulanishi qolib ketgan bo'lsa uzadi
  await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await client.query(sql);
    } catch (err) {
      await client.end();
      throw new Error(`Migratsiya buzildi: ${file}\n${String(err)}`);
    }
  }

  await client.end();
}

export async function teardown(): Promise<void> {
  // Baza ataylab qoldiriladi: test yiqilganda ichiga qarash mumkin.
  // Keyingi ishga tushirishda u baribir qayta quriladi.
}
