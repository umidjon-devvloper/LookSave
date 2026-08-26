import type { Locale } from '@looksave/shared-types';
import type { TryonSlotQuery, CreateLookInput, Slot } from '@looksave/validation';

import { pickName } from '../catalog/locale';
import { decodeCursor } from '../catalog/cursor';
import { pool } from '../db/pool';
import { ApiError } from '../http/api-error';

/**
 * Try-On ma'lumotlari (03-api-spec §10).
 *
 * Asosiy tamoyil: svayp paytida tarmoqqa chiqilmaydi. Ilova bitta
 * so'rovda 50 tagacha modelni oladi va xotirada saqlaydi. Shuning
 * uchun bu yerdagi so'rov bir marta ishlaydi, lekin to'liq bo'lishi kerak.
 */

const SLOT_LABELS: Record<Slot, Record<Locale, string>> = {
  head: { uz: 'Bosh kiyim', ru: 'Головные уборы', en: 'Headwear', ar: 'أغطية الرأس' },
  face: { uz: "Ko'zoynak", ru: 'Очки', en: 'Eyewear', ar: 'نظارات' },
  neck: { uz: 'Sharf', ru: 'Шарфы', en: 'Neckwear', ar: 'أوشحة' },
  top: { uz: 'Ustki kiyim', ru: 'Верх', en: 'Tops', ar: 'ملابس علوية' },
  outer: { uz: 'Kurtka', ru: 'Верхняя одежда', en: 'Outerwear', ar: 'ملابس خارجية' },
  bottom: { uz: 'Pastki kiyim', ru: 'Низ', en: 'Bottoms', ar: 'ملابس سفلية' },
  feet: { uz: 'Oyoq kiyim', ru: 'Обувь', en: 'Shoes', ar: 'أحذية' },
  wrist: { uz: 'Soat', ru: 'Часы', en: 'Watches', ar: 'ساعات' },
  bag: { uz: 'Sumka', ru: 'Сумки', en: 'Bags', ar: 'حقائب' },
};

/** GET /tryon/slots — har slotda nechta tayyor model bor. */
export async function getSlots(locale: Locale, gender?: string) {
  const params: unknown[] = [];
  const genderFilter = gender ? `AND p.gender IN ($${params.push(gender)}, 'unisex')` : '';

  const { rows } = await pool.query<{ slot: Slot; count: string }>(
    `SELECT p.slot, COUNT(DISTINCT v.id) AS count
       FROM products p
       JOIN product_variants v ON v.product_id = p.id AND v.is_active
       JOIN assets_3d a ON a.variant_id = v.id AND a.status = 'ready'
       JOIN stores s ON s.id = p.store_id AND s.status = 'active'
      WHERE p.status = 'active' ${genderFilter}
      GROUP BY p.slot
      ORDER BY p.slot`,
    params,
  );

  return rows
    .filter((row) => row.slot in SLOT_LABELS)
    .map((row) => ({
      slot: row.slot,
      label: SLOT_LABELS[row.slot][locale] ?? SLOT_LABELS[row.slot].uz,
      count: Number(row.count),
    }));
}

interface TryonRow {
  variant_id: string;
  product_id: string;
  title: string;
  color_hex: string | null;
  color_name: Record<string, string> | null;
  price: string;
  currency: string;
  thumbnail: string | null;
  texture_url: string | null;
  product_images: unknown;
  variant_images: unknown;
  glb_url: string | null;
  lod_urls: unknown;
  file_size_bytes: number | null;
  hide_body_parts: string[] | null;
  has_morphs: boolean;
  store_id: string;
  store_name: string;
  tryon_count: number;
  distance_m: number | null;
}

/**
 * GET /tryon/slot/:slot ⭐ — svayp ro'yxati.
 *
 * Saralash: ommaboplik bo'yicha. Foydalanuvchi birinchi svayplarda
 * eng yaxshi modellarni ko'rishi kerak — birinchi taassurot shu.
 */
export async function getSlotItems(slot: Slot, query: TryonSlotQuery) {
  const params: unknown[] = [slot];
  const conditions = [
    `p.slot = $1`,
    `p.status = 'active'`,
    `s.status = 'active'`,
    `v.is_active`,
    `a.status = 'ready'`,
  ];

  const add = (value: unknown): number => params.push(value);

  let distanceExpr = 'NULL::int';
  if (query.lat !== undefined && query.lng !== undefined) {
    const lng = add(query.lng);
    const lat = add(query.lat);
    distanceExpr = `ST_Distance(s.location, ST_MakePoint($${lng}, $${lat})::geography)::int`;
    // Radius filtri GIST index'dan foydalanadi
    conditions.push(
      `ST_DWithin(s.location, ST_MakePoint($${lng}, $${lat})::geography, $${add(query.radius)})`,
    );
  }

  if (query.gender !== undefined) {
    conditions.push(`p.gender IN ($${add(query.gender)}, 'unisex')`);
  }

  if (query.storeId !== undefined) {
    conditions.push(`p.store_id = $${add(query.storeId)}`);
  }

  if (query.cursor !== undefined) {
    const cursor = decodeCursor(query.cursor);
    const key = add(Number(cursor.k));
    const id = add(cursor.id);
    conditions.push(`(p.tryon_count, v.id) < ($${key}::int, $${id}::uuid)`);
  }

  const limitIndex = add(query.limit + 1);

  const { rows } = await pool.query<TryonRow>(
    `SELECT v.id AS variant_id, p.id AS product_id, p.title, p.base_price AS price,
            p.currency, p.tryon_count,
            v.color_hex, v.color_name,
            a.thumbnail_url AS thumbnail, a.texture_url,
            p.images AS product_images, v.images AS variant_images,
            a.glb_url, a.lod_urls, a.file_size_bytes,
            a.hide_body_parts, a.has_morphs,
            s.id AS store_id, s.name AS store_name,
            ${distanceExpr} AS distance_m
       FROM products p
       JOIN product_variants v ON v.product_id = p.id
       JOIN assets_3d a ON a.variant_id = v.id
       JOIN stores s ON s.id = p.store_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.tryon_count DESC, v.id DESC
      LIMIT $${limitIndex}`,
    params,
  );

  return rows;
}

/**
 * Rasmlar ro'yxatidan birinchi haqiqiy havolani oladi. Element string
 * yoki `{url}` bo'lishi mumkin (sxema vaqt o'tib o'zgargan).
 */
function firstImage(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    if (typeof item === 'string' && item.length > 0) return item;
    if (item && typeof item === 'object') {
      const url = (item as { url?: string; src?: string }).url ?? (item as { src?: string }).src;
      if (typeof url === 'string' && url.length > 0) return url;
    }
  }
  return null;
}

export function toTryonDto(row: TryonRow, locale: Locale) {
  return {
    variantId: row.variant_id,
    productId: row.product_id,
    title: row.title,
    colorHex: row.color_hex,
    colorName: pickName(row.color_name, locale),
    // Pul — string
    price: row.price,
    currency: row.currency,
    /*
     * ⚠️ KARTA RASMI ZAXIRASI. `assets_3d.thumbnail_url` ko'pincha bo'sh
     * (generator uni yasamaydi). Bo'sh bo'lsa mahsulot/variant fotosiga
     * tushamiz — aks holda kartada bo'sh kul-rang ikonka ko'rinardi.
     */
    thumbnail: row.thumbnail ?? firstImage(row.variant_images) ?? firstImage(row.product_images),
    /** Mahsulot surati — ilova uni dekod qilib kiyim old tomoniga qo'yadi */
    textureUrl: row.texture_url,
    glbUrl: row.glb_url,
    lodUrls: row.lod_urls,
    fileSizeBytes: row.file_size_bytes,
    hideBodyParts: row.hide_body_parts ?? [],
    hasMorphs: row.has_morphs,
    storeId: row.store_id,
    storeName: row.store_name,
    distanceM: row.distance_m,
    cursorKey: String(row.tryon_count),
  };
}

/**
 * POST /tryon/event — analitika.
 * Sanoq `products.tryon_count` da saqlanadi: u svayp ro'yxatining
 * saralash kaliti, shuning uchun darhol yangilanishi kerak.
 */
export async function recordTryonEvent(
  userId: string | null,
  variantId: string,
  durationMs: number | null,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO tryon_events (user_id, variant_id, duration_ms) VALUES ($1, $2, $3)`,
      [userId, variantId, durationMs],
    );

    await client.query(
      `UPDATE products SET tryon_count = tryon_count + 1
        WHERE id = (SELECT product_id FROM product_variants WHERE id = $1)`,
      [variantId],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================
// Sevimlilar
// ============================================================

export async function addFavorite(userId: string, productId: string): Promise<void> {
  await pool.query(
    `INSERT INTO favorites (user_id, product_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, productId],
  );
}

export async function removeFavorite(userId: string, productId: string): Promise<void> {
  await pool.query(`DELETE FROM favorites WHERE user_id = $1 AND product_id = $2`, [
    userId,
    productId,
  ]);
}

export async function listFavorites(userId: string, limit: number) {
  const { rows } = await pool.query<{
    id: string;
    title: string;
    base_price: string;
    currency: string;
    images: unknown;
    has_3d: boolean;
    status: string;
    store_id: string;
    store_name: string;
  }>(
    `SELECT p.id, p.title, p.base_price, p.currency, p.images, p.has_3d, p.status,
            s.id AS store_id, s.name AS store_name
       FROM favorites f
       JOIN products p ON p.id = f.product_id
       JOIN stores s ON s.id = p.store_id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
      LIMIT $2`,
    [userId, limit],
  );

  return rows.map((row) => {
    const images = Array.isArray(row.images) ? row.images : [];
    return {
      id: row.id,
      title: row.title,
      price: row.base_price,
      currency: row.currency,
      image: typeof images[0] === 'string' ? images[0] : null,
      has3d: row.has_3d,
      // Arxivlangan mahsulot sevimlilarda qoladi, lekin ochib bo'lmaydi
      isAvailable: row.status === 'active',
      store: { id: row.store_id, name: row.store_name },
    };
  });
}

// ============================================================
// Komplektlar
// ============================================================

export async function createLook(userId: string, input: CreateLookInput) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query<{ id: string; created_at: Date }>(
      `INSERT INTO looks (user_id, name, thumbnail_url, occasion, is_public, created_by)
       VALUES ($1, $2, $3, $4, $5, 'user')
       RETURNING id, created_at`,
      [
        userId,
        input.name ?? null,
        input.thumbnailUrl ?? null,
        input.occasion ?? null,
        input.isPublic,
      ],
    );

    const look = rows[0];
    if (!look) throw ApiError.internal('Komplekt yaratilmadi');

    for (const item of input.items) {
      // Variant mavjudligini tekshiramiz — yo'q bo'lsa FK xato beradi
      await client.query(
        `INSERT INTO look_items (look_id, slot, variant_id, size) VALUES ($1, $2, $3, $4)`,
        [look.id, item.slot, item.variantId, item.size ?? null],
      );
    }

    await client.query('COMMIT');
    return { id: look.id, createdAt: look.created_at.toISOString() };
  } catch (err) {
    await client.query('ROLLBACK');
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === '23503') {
      throw ApiError.notFound('Mahsulot topilmadi');
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function listLooks(userId: string, locale: Locale, limit: number) {
  const { rows } = await pool.query<{
    id: string;
    name: string | null;
    thumbnail_url: string | null;
    occasion: string | null;
    created_at: Date;
    items: Array<{
      slot: string;
      variant_id: string;
      size: string | null;
      title: string;
      color_name: Record<string, string> | null;
      price: string;
      currency: string;
    }> | null;
  }>(
    `SELECT l.id, l.name, l.thumbnail_url, l.occasion, l.created_at,
            (SELECT json_agg(json_build_object(
                      'slot', li.slot, 'variant_id', li.variant_id, 'size', li.size,
                      'title', p.title, 'color_name', v.color_name,
                      -- ::text SHART: json ichida NUMERIC songa aylanadi
                      'price', p.base_price::text, 'currency', p.currency))
               FROM look_items li
               JOIN product_variants v ON v.id = li.variant_id
               JOIN products p ON p.id = v.product_id
              WHERE li.look_id = l.id) AS items
       FROM looks l
      WHERE l.user_id = $1
      ORDER BY l.created_at DESC
      LIMIT $2`,
    [userId, limit],
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    thumbnailUrl: row.thumbnail_url,
    occasion: row.occasion,
    createdAt: row.created_at.toISOString(),
    items: (row.items ?? []).map((item) => ({
      slot: item.slot,
      variantId: item.variant_id,
      size: item.size,
      title: item.title,
      colorName: pickName(item.color_name, locale),
      price: item.price,
      currency: item.currency,
    })),
  }));
}

export async function deleteLook(userId: string, lookId: string): Promise<void> {
  const { rowCount } = await pool.query(`DELETE FROM looks WHERE id = $1 AND user_id = $2`, [
    lookId,
    userId,
  ]);
  if ((rowCount ?? 0) === 0) throw ApiError.notFound('Komplekt topilmadi');
}
