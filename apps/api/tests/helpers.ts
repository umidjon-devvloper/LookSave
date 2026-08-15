import type { Express } from 'express';
import request from 'supertest';

import { createApp } from '../src/app';
import { pool } from '../src/db/pool';
import { redis } from '../src/db/redis';

/**
 * Testlar bir xil app nusxasidan foydalanadi — har testda yangisini
 * yaratish Redis va Postgres ulanishlarini ko'paytiradi.
 */
export const app: Express = createApp();

export interface Actor {
  id: string;
  phone: string;
  token: string;
  headers: Record<string, string>;
}

let counter = 0;

/**
 * Har test o'z raqamini oladi.
 *
 * ⚠️ Sanoq test FAYLI ichida ishlaydi: vitest har faylni alohida
 * modul sifatida yuklaydi, shuning uchun oddiy hisoblagich fayllar
 * orasida takrorlanadi va ikkinchi fayl `ALREADY_EXISTS` oladi.
 * Shu sababli tasodifiy qism ham qo'shiladi.
 */
export function uniquePhone(): string {
  counter += 1;
  const random = Math.floor(Math.random() * 10_000_000);
  const suffix = String(random * 10 + (counter % 10))
    .padStart(7, '0')
    .slice(0, 7);
  return `+99890${suffix}`;
}

export async function registerCustomer(fullName = 'Test Mijoz'): Promise<Actor> {
  const phone = uniquePhone();

  const response = await request(app)
    .post('/v1/auth/register')
    .send({ phone, fullName, password: 'parol12345' });

  if (response.status !== 201) {
    throw new Error(`register ${response.status}: ${JSON.stringify(response.body)}`);
  }

  const token = response.body.data.accessToken as string;

  return {
    id: response.body.data.user.id as string,
    phone,
    token,
    headers: { Authorization: `Bearer ${token}` },
  };
}

/** Rate limit testlar orasida saqlanib qolmasin. */
export async function resetRateLimits(): Promise<void> {
  const keys = await redis.keys('rl:*');
  if (keys.length > 0) await redis.del(...keys);
}

export interface Fixture {
  storeId: string;
  ownerId: string;
  productId: string;
  variantId: string;
  categoryId: string;
}

/**
 * Do'kon, mahsulot, variant va ombor yaratadi.
 * Seed fayllariga tayanmaymiz — test o'zi kerakli holatni quradi.
 */
export async function createStoreFixture(options: { stock?: number } = {}): Promise<Fixture> {
  const stock = options.stock ?? 10;

  const owner = await pool.query<{ id: string }>(
    `INSERT INTO users (phone, full_name, role, country)
     VALUES ($1, 'Test Sotuvchi', 'store_owner', 'UZ') RETURNING id`,
    [uniquePhone()],
  );
  const ownerId = owner.rows[0]?.id ?? '';

  const store = await pool.query<{ id: string }>(
    `INSERT INTO stores (owner_id, name, slug, location, address, city, country, phone,
                         currency, status, delivery_radius_m, delivery_fee, working_hours)
     VALUES ($1, 'Test Do''kon', $2, ST_MakePoint(69.2797, 41.3111)::geography,
             'Test manzil', 'Toshkent', 'UZ', '+998901112233', 'UZS', 'active', 15000, '15000.00',
             '[{"day":1,"open":"00:00","close":"00:00"}]')
     RETURNING id`,
    [ownerId, `test-store-${Date.now()}-${counter}`],
  );
  const storeId = store.rows[0]?.id ?? '';

  const category = await pool.query<{ id: string }>(
    `SELECT id FROM categories WHERE slot IS NOT NULL LIMIT 1`,
  );
  const categoryId = category.rows[0]?.id ?? '';

  const product = await pool.query<{ id: string }>(
    `INSERT INTO products (store_id, category_id, title, slot, gender, base_price, currency,
                           status, images)
     VALUES ($1, $2, 'Test mahsulot', 'top', 'unisex', '100000.00', 'UZS', 'active',
             '["https://cdn.looksave.app/a.webp"]')
     RETURNING id`,
    [storeId, categoryId],
  );
  const productId = product.rows[0]?.id ?? '';

  const variant = await pool.query<{ id: string }>(
    `INSERT INTO product_variants (product_id, color_hex, color_name)
     VALUES ($1, '#1a1a1a', '{"uz":"Qora"}') RETURNING id`,
    [productId],
  );
  const variantId = variant.rows[0]?.id ?? '';

  await pool.query(`INSERT INTO variant_stock (variant_id, size, stock) VALUES ($1, 'M', $2)`, [
    variantId,
    stock,
  ]);

  return { storeId, ownerId, productId, variantId, categoryId };
}

export function idempotencyKey(): string {
  counter += 1;
  return `test-key-${Date.now()}-${counter}`;
}

export async function closeConnections(): Promise<void> {
  await pool.end();
  await redis.quit();
}

export { request };
