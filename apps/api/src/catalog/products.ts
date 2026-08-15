import type { ProductsQuery } from '@looksave/validation';

import { pool } from '../db/pool';
import { decodeCursor } from './cursor';

export interface ProductListRow {
  id: string;
  title: string;
  base_price: string;
  old_price: string | null;
  currency: string;
  images: unknown;
  has_3d: boolean;
  is_limited: boolean;
  created_at: Date;
  /**
   * Cursor uchun: `created_at` ning mikrosekundgacha aniq matn ko'rinishi.
   * JS `Date` faqat millisekundni saqlaydi — `toISOString()` dan yasalgan
   * cursor mikrosekundlarni yo'qotadi va keyingi sahifa BO'SH qaytadi.
   */
  created_at_key: string;
  tryon_count: number;
  brand_id: string | null;
  brand_name: string | null;
  store_id: string;
  store_name: string;
  distance_m: number | null;
  available_sizes: string[] | null;
}

interface SortPlan {
  /** ORDER BY ifodasi */
  orderBy: string;
  /** Cursor uchun taqqoslash sharti (`$n` — kalit, `$n+1` — id) */
  compare: (keyParam: number, idParam: number, distanceExpr: string) => string;
  /** Qator qiymatidan cursor kalitini olish */
  keyOf: (row: ProductListRow) => string;
}

function sortPlan(sort: ProductsQuery['sort']): SortPlan {
  switch (sort) {
    case 'popular':
      return {
        orderBy: 'p.tryon_count DESC, p.id DESC',
        compare: (k, i) => `(p.tryon_count, p.id) < ($${k}::int, $${i}::uuid)`,
        keyOf: (row) => String(row.tryon_count),
      };
    case 'priceAsc':
      return {
        orderBy: 'p.base_price ASC, p.id ASC',
        compare: (k, i) => `(p.base_price, p.id) > ($${k}::numeric, $${i}::uuid)`,
        keyOf: (row) => row.base_price,
      };
    case 'priceDesc':
      return {
        orderBy: 'p.base_price DESC, p.id DESC',
        compare: (k, i) => `(p.base_price, p.id) < ($${k}::numeric, $${i}::uuid)`,
        keyOf: (row) => row.base_price,
      };
    case 'nearest':
      return {
        orderBy: 'distance_m ASC, p.id ASC',
        compare: (k, i, distanceExpr) => `(${distanceExpr}, p.id) > ($${k}::int, $${i}::uuid)`,
        keyOf: (row) => String(row.distance_m ?? 0),
      };
    default:
      return {
        orderBy: 'p.created_at DESC, p.id DESC',
        compare: (k, i) => `(p.created_at, p.id) < ($${k}::timestamptz, $${i}::uuid)`,
        keyOf: (row) => row.created_at_key,
      };
  }
}

/**
 * Katalog filtri (03-api-spec §9, 02-database §10.2).
 *
 * `limit + 1` ta qator olinadi — `hasMore` shu bilan aniqlanadi,
 * alohida `COUNT(*)` so'rovi kerak emas (u katalog o'sganda qimmatlashadi).
 */
export async function findProducts(query: ProductsQuery): Promise<ProductListRow[]> {
  const params: unknown[] = [];
  const conditions: string[] = [`p.status = 'active'`, `s.status = 'active'`];

  /** Parametrni qo'shib, uning `$n` raqamini qaytaradi. */
  const add = (value: unknown): number => params.push(value);

  // Nuqta berilmasa lat/lng parametrlari UMUMAN qo'shilmaydi — aks holda
  // Postgres ishlatilmagan parametr turini aniqlay olmaydi (42P18).
  let distanceExpr = 'NULL::int';
  if (query.lat !== undefined && query.lng !== undefined) {
    const lngIndex = add(query.lng);
    const latIndex = add(query.lat);
    distanceExpr = `ST_Distance(s.location, ST_MakePoint($${lngIndex}, $${latIndex})::geography)::int`;
  }

  if (query.storeId !== undefined) {
    conditions.push(`p.store_id = $${add(query.storeId)}`);
  }

  if (query.gender !== undefined) {
    conditions.push(`p.gender IN ($${add(query.gender)}, 'unisex')`);
  }

  if (query.brand !== undefined) {
    conditions.push(`b.slug = $${add(query.brand)}`);
  }

  if (query.category !== undefined) {
    // Kategoriya daraxti: `shoes` so'ralsa `sneakers`, `boots` ham kiradi
    conditions.push(`p.category_id IN (
      WITH RECURSIVE tree AS (
        SELECT id FROM categories WHERE slug = $${add(query.category)}
        UNION ALL
        SELECT c.id FROM categories c JOIN tree t ON c.parent_id = t.id
      )
      SELECT id FROM tree
    )`);
  }

  if (query.priceMin !== undefined) {
    conditions.push(`p.base_price >= $${add(query.priceMin)}`);
  }

  if (query.priceMax !== undefined) {
    conditions.push(`p.base_price <= $${add(query.priceMax)}`);
  }

  if (query.limited) {
    conditions.push(`p.is_limited = true`);
  }

  if (query.only3d) {
    conditions.push(`p.has_3d`);
  }

  if (query.q !== undefined) {
    // To'liq matnli qidiruv + trigram.
    //
    // `<%` (word_similarity) ishlatiladi, `%` (similarity) EMAS: `%` butun
    // sarlavhani so'rov bilan solishtiradi, shuning uchun uzun sarlavha
    // qisqa so'rovga hech qachon mos kelmaydi ("nike" vs "Nike Air Max 90"
    // similarity = 0.05). `<%` esa eng mos so'zni topadi (0.75+).
    //
    // ⚠️ Bu XATO YOZILISHNI tuzatadi ("nikee", "futbolk"), transliteratsiyani
    // emas ("nayk" → "Nike" ishlamaydi — buning uchun sinonim lug'ati kerak).
    const qIndex = add(query.q);
    conditions.push(
      `(p.search_vec @@ plainto_tsquery('simple', $${qIndex}) OR $${qIndex} <% p.title)`,
    );
  }

  const plan = sortPlan(query.sort);

  if (query.cursor !== undefined) {
    const cursor = decodeCursor(query.cursor);
    const keyIndex = add(cursor.k);
    const idIndex = add(cursor.id);
    conditions.push(plan.compare(keyIndex, idIndex, distanceExpr));
  }

  const limitIndex = add(query.limit + 1);

  const { rows } = await pool.query<ProductListRow>(
    `SELECT p.id, p.title, p.base_price, p.old_price, p.currency, p.images,
            p.has_3d, p.is_limited, p.created_at, p.tryon_count,
            to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') || '+00'
              AS created_at_key,
            b.id AS brand_id, b.name AS brand_name,
            s.id AS store_id, s.name AS store_name,
            ${distanceExpr} AS distance_m,
            sizes.available_sizes
       FROM products p
       JOIN stores s ON s.id = p.store_id
       LEFT JOIN brands b ON b.id = p.brand_id
       CROSS JOIN LATERAL (
         SELECT array_agg(DISTINCT vs.size ORDER BY vs.size) AS available_sizes
           FROM product_variants v
           JOIN variant_stock vs ON vs.variant_id = v.id
          WHERE v.product_id = p.id AND v.is_active AND vs.stock > vs.reserved
       ) sizes
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${plan.orderBy}
      LIMIT $${limitIndex}`,
    params,
  );

  return rows;
}

export function productCursorKey(sort: ProductsQuery['sort']) {
  return sortPlan(sort).keyOf;
}

function firstImage(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  const first = images[0];
  return typeof first === 'string' ? first : null;
}

export interface ProductListDto {
  id: string;
  title: string;
  brand: { id: string; name: string } | null;
  store: { id: string; name: string; distanceM: number | null };
  price: string;
  oldPrice: string | null;
  currency: string;
  image: string | null;
  has3d: boolean;
  isLimited: boolean;
  availableSizes: string[];
}

export function toProductListDto(row: ProductListRow): ProductListDto {
  return {
    id: row.id,
    title: row.title,
    brand: row.brand_id && row.brand_name ? { id: row.brand_id, name: row.brand_name } : null,
    store: { id: row.store_id, name: row.store_name, distanceM: row.distance_m },
    // Pul NUMERIC → string, hech qachon Number() qilinmaydi
    price: row.base_price,
    oldPrice: row.old_price,
    currency: row.currency,
    image: firstImage(row.images),
    has3d: row.has_3d,
    isLimited: row.is_limited,
    availableSizes: row.available_sizes ?? [],
  };
}

interface ProductDetailRow {
  id: string;
  title: string;
  description: string | null;
  slot: string;
  gender: string;
  base_price: string;
  old_price: string | null;
  currency: string;
  images: unknown;
  tags: string[];
  is_limited: boolean;
  category_id: string;
  category_slug: string;
  category_name: Record<string, string>;
  size_type: string | null;
  brand_id: string | null;
  brand_name: string | null;
  brand_logo: string | null;
  brand_is_partner: boolean | null;
  store_id: string;
  store_name: string;
  store_logo: string | null;
  store_country: 'UZ' | 'AE';
  store_working_hours: unknown;
  store_avg_response_min: number | null;
  distance_m: number | null;
}

export async function findProductById(
  id: string,
  point: { lat: number; lng: number } | null,
): Promise<ProductDetailRow | null> {
  // Nuqta bo'lmasa parametrlar qo'shilmaydi (42P18 oldini olish)
  const distanceExpr = point
    ? `ST_Distance(s.location, ST_MakePoint($2, $3)::geography)::int`
    : `NULL::int`;

  const params: unknown[] = point ? [id, point.lng, point.lat] : [id];

  const { rows } = await pool.query<ProductDetailRow>(
    `SELECT p.id, p.title, p.description, p.slot, p.gender, p.base_price, p.old_price,
            p.currency, p.images, p.tags, p.is_limited,
            c.id AS category_id, c.slug AS category_slug, c.name AS category_name,
            c.size_type,
            b.id AS brand_id, b.name AS brand_name, b.logo_url AS brand_logo,
            b.is_partner AS brand_is_partner,
            s.id AS store_id, s.name AS store_name, s.logo_url AS store_logo,
            s.country AS store_country, s.working_hours AS store_working_hours,
            s.avg_response_min AS store_avg_response_min,
            ${distanceExpr} AS distance_m
       FROM products p
       JOIN stores s ON s.id = p.store_id
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN brands b ON b.id = p.brand_id
      WHERE p.id = $1 AND p.status = 'active' AND s.status = 'active'`,
    params,
  );

  return rows[0] ?? null;
}

export interface VariantRow {
  id: string;
  color_hex: string | null;
  color_name: Record<string, string> | null;
  images: unknown;
  price_delta: string;
  sizes: Array<{ size: string; stock: number; reserved: number }> | null;
  asset_status: string | null;
  glb_url: string | null;
  lod_urls: unknown;
  thumbnail_url: string | null;
  file_size_bytes: number | null;
  hide_body_parts: string[] | null;
  has_morphs: boolean | null;
}

export async function findProductVariants(productId: string): Promise<VariantRow[]> {
  const { rows } = await pool.query<VariantRow>(
    `SELECT v.id, v.color_hex, v.color_name, v.images, v.price_delta,
            stock.sizes,
            a.status AS asset_status, a.glb_url, a.lod_urls, a.thumbnail_url,
            a.file_size_bytes, a.hide_body_parts, a.has_morphs
       FROM product_variants v
       LEFT JOIN assets_3d a ON a.variant_id = v.id
       CROSS JOIN LATERAL (
         SELECT json_agg(json_build_object('size', vs.size, 'stock', vs.stock,
                                           'reserved', vs.reserved)
                         ORDER BY vs.size) AS sizes
           FROM variant_stock vs WHERE vs.variant_id = v.id
       ) stock
      WHERE v.product_id = $1 AND v.is_active
      ORDER BY v.sort_order, v.id`,
    [productId],
  );
  return rows;
}

export async function findVariantAsset(variantId: string): Promise<VariantRow | null> {
  const { rows } = await pool.query<VariantRow>(
    `SELECT v.id, v.color_hex, v.color_name, v.images, v.price_delta,
            NULL::json AS sizes,
            a.status AS asset_status, a.glb_url, a.lod_urls, a.thumbnail_url,
            a.file_size_bytes, a.hide_body_parts, a.has_morphs
       FROM product_variants v
       JOIN products p ON p.id = v.product_id AND p.status = 'active'
       JOIN stores s ON s.id = p.store_id AND s.status = 'active'
       LEFT JOIN assets_3d a ON a.variant_id = v.id
      WHERE v.id = $1 AND v.is_active`,
    [variantId],
  );
  return rows[0] ?? null;
}

export async function isFavorite(userId: string, productId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM favorites WHERE user_id = $1 AND product_id = $2`,
    [userId, productId],
  );
  return (rowCount ?? 0) > 0;
}

/** Ko'rishlar sanog'i. Javobni kutib turmaydi — sanoq muhim, lekin kritik emas. */
export async function incrementViewCount(productId: string): Promise<void> {
  await pool.query(`UPDATE products SET view_count = view_count + 1 WHERE id = $1`, [productId]);
}
