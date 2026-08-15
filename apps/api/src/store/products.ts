import type {
  CreateProductInput,
  StoreProductsQuery,
  UpdateProductInput,
  VariantInput,
} from '@looksave/validation';
import type { PoolClient } from 'pg';

import { pool } from '../db/pool';
import { ApiError } from '../http/api-error';
import { isOwnCdnUrl } from '../integrations/r2';

/**
 * Do'kon mahsulotlari (03-api-spec §13).
 *
 * Do'kon mahsulotni `active` qila olmaydi — faqat `draft` yoki `pending`.
 * `active` ga o'tkazish admin moderatsiyasi orqali (07-web-panels §5.1).
 */

function assertOwnImages(images: string[]): void {
  const foreign = images.find((url) => !isOwnCdnUrl(url));
  if (foreign !== undefined) {
    throw new ApiError('BAD_REQUEST', 'Rasm faqat presign orqali yuklanishi kerak', {
      url: foreign,
    });
  }
}

interface CategoryRow {
  id: string;
  slot: string | null;
}

async function loadCategory(client: PoolClient, categoryId: string): Promise<CategoryRow> {
  const { rows } = await client.query<CategoryRow>(
    `SELECT id, slot FROM categories WHERE id = $1 AND is_active`,
    [categoryId],
  );
  const category = rows[0];
  if (!category) throw ApiError.notFound('Kategoriya topilmadi');
  if (!category.slot) {
    // `slot` — 3D avatarda kiyim qaysi joyga tushishini belgilaydi
    throw new ApiError('BAD_REQUEST', 'Bu kategoriyaga mahsulot qo`shib bo`lmaydi');
  }
  return category;
}

async function insertVariant(
  client: PoolClient,
  productId: string,
  variant: VariantInput,
  sortOrder: number,
): Promise<string> {
  assertOwnImages(variant.images);

  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO product_variants (product_id, color_hex, color_name, images,
                                   price_delta, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      productId,
      variant.colorHex ?? null,
      variant.colorName ? JSON.stringify(variant.colorName) : null,
      JSON.stringify(variant.images),
      variant.priceDelta,
      sortOrder,
    ],
  );

  const created = rows[0];
  if (!created) throw ApiError.internal('Variant yaratilmadi');

  for (const size of variant.sizes) {
    await client.query(
      `INSERT INTO variant_stock (variant_id, size, stock) VALUES ($1, $2, $3)
       ON CONFLICT (variant_id, size) DO UPDATE SET stock = EXCLUDED.stock`,
      [created.id, size.size, size.stock],
    );
  }

  return created.id;
}

export async function createProduct(
  storeId: string,
  input: CreateProductInput,
): Promise<{ id: string; status: string }> {
  assertOwnImages(input.images);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const category = await loadCategory(client, input.categoryId);

    // Valyuta do'kondan olinadi — mahsulot bo'yicha o'zgarmaydi
    const { rows: storeRows } = await client.query<{ currency: string }>(
      `SELECT currency FROM stores WHERE id = $1 AND status = 'active'`,
      [storeId],
    );
    const store = storeRows[0];
    if (!store) throw ApiError.notFound('Do`kon topilmadi yoki faol emas');

    const { rows } = await client.query<{ id: string; status: string }>(
      `INSERT INTO products (store_id, brand_id, category_id, title, description, slot,
                             gender, base_price, old_price, currency, images, tags,
                             is_limited, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id, status`,
      [
        storeId,
        input.brandId ?? null,
        category.id,
        input.title,
        input.description ?? null,
        // `slot` kategoriyadan ko'chiriladi — katalog filtri tez ishlashi uchun
        category.slot,
        input.gender,
        input.basePrice,
        input.oldPrice ?? null,
        store.currency,
        JSON.stringify(input.images),
        input.tags,
        input.isLimited,
        input.status,
      ],
    );

    const product = rows[0];
    if (!product) throw ApiError.internal('Mahsulot yaratilmadi');

    let index = 0;
    for (const variant of input.variants) {
      const variantId = await insertVariant(client, product.id, variant, index);
      index += 1;

      if (input.request3d) {
        await client.query(
          `INSERT INTO assets_3d (variant_id, status, requested_at)
           VALUES ($1, 'queued', now())
           ON CONFLICT (variant_id) DO NOTHING`,
          [variantId],
        );
      }
    }

    await client.query('COMMIT');
    return product;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const UPDATABLE: Record<string, string> = {
  title: 'title',
  description: 'description',
  brandId: 'brand_id',
  gender: 'gender',
  basePrice: 'base_price',
  oldPrice: 'old_price',
  images: 'images',
  tags: 'tags',
  isLimited: 'is_limited',
  status: 'status',
};

export async function updateProduct(
  storeId: string,
  productId: string,
  input: UpdateProductInput,
): Promise<{ id: string; status: string }> {
  if (input.images) assertOwnImages(input.images);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: current } = await client.query<{ status: string }>(
      `SELECT status FROM products WHERE id = $1 AND store_id = $2 FOR UPDATE`,
      [productId, storeId],
    );
    if (!current[0]) throw ApiError.notFound('Mahsulot topilmadi');

    const fields: string[] = [];
    const params: unknown[] = [productId, storeId];

    for (const [key, column] of Object.entries(UPDATABLE)) {
      const value = (input as Record<string, unknown>)[key];
      if (value === undefined) continue;

      params.push(key === 'images' ? JSON.stringify(value) : value);
      fields.push(`${column} = $${params.length}`);
    }

    // Kategoriya o'zgarsa `slot` ham yangilanadi
    if (input.categoryId !== undefined) {
      const category = await loadCategory(client, input.categoryId);
      params.push(category.id, category.slot);
      fields.push(`category_id = $${params.length - 1}`, `slot = $${params.length}`);
    }

    if (fields.length === 0) throw new ApiError('BAD_REQUEST', 'O`zgartirish uchun maydon yo`q');

    const { rows } = await client.query<{ id: string; status: string }>(
      `UPDATE products SET ${fields.join(', ')}
        WHERE id = $1 AND store_id = $2
        RETURNING id, status`,
      params,
    );

    await client.query('COMMIT');
    const updated = rows[0];
    if (!updated) throw ApiError.notFound('Mahsulot topilmadi');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * O'chirish — arxivlash. Qator o'chirilmaydi, chunki unga eski
 * buyurtmalar bog'langan (`order_items.variant_id`).
 */
export async function archiveProduct(storeId: string, productId: string): Promise<void> {
  const { rowCount } = await pool.query(
    `UPDATE products SET status = 'archived' WHERE id = $1 AND store_id = $2`,
    [productId, storeId],
  );
  if ((rowCount ?? 0) === 0) throw ApiError.notFound('Mahsulot topilmadi');
}

export async function addVariant(
  storeId: string,
  productId: string,
  variant: VariantInput,
): Promise<{ id: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query<{ count: string }>(
      `SELECT COUNT(v.id) AS count
         FROM products p LEFT JOIN product_variants v ON v.product_id = p.id
        WHERE p.id = $1 AND p.store_id = $2
        GROUP BY p.id`,
      [productId, storeId],
    );
    if (!rows[0]) throw ApiError.notFound('Mahsulot topilmadi');

    const id = await insertVariant(client, productId, variant, Number(rows[0].count));
    await client.query('COMMIT');
    return { id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Ombor yangilash. `reserved` ga tegilmaydi — u faol buyurtmalarga
 * bog'langan va faqat trigger orqali o'zgaradi (010_orders_flow.sql).
 */
export async function updateStock(
  storeId: string,
  variantId: string,
  sizes: Array<{ size: string; stock: number }>,
): Promise<Array<{ size: string; stock: number; reserved: number }>> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rowCount } = await client.query(
      `SELECT 1 FROM product_variants v
         JOIN products p ON p.id = v.product_id
        WHERE v.id = $1 AND p.store_id = $2`,
      [variantId, storeId],
    );
    if ((rowCount ?? 0) === 0) throw ApiError.notFound('Variant topilmadi');

    for (const size of sizes) {
      // Rezerv qilingandan kam qilib bo'lmaydi — aks holda buyurtma
      // qilingan tovar "yo'q" bo'lib qoladi
      const { rows } = await client.query<{ reserved: number }>(
        `SELECT reserved FROM variant_stock WHERE variant_id = $1 AND size = $2 FOR UPDATE`,
        [variantId, size.size],
      );

      const reserved = rows[0]?.reserved ?? 0;
      if (size.stock < reserved) {
        throw new ApiError('INVALID_STATE', `"${size.size}" — ${reserved} dona buyurtmada`, {
          size: size.size,
          reserved,
        });
      }

      await client.query(
        `INSERT INTO variant_stock (variant_id, size, stock) VALUES ($1, $2, $3)
         ON CONFLICT (variant_id, size) DO UPDATE SET stock = EXCLUDED.stock`,
        [variantId, size.size, size.stock],
      );
    }

    const { rows: result } = await client.query<{
      size: string;
      stock: number;
      reserved: number;
    }>(`SELECT size, stock, reserved FROM variant_stock WHERE variant_id = $1 ORDER BY size`, [
      variantId,
    ]);

    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** 3D model buyurtma qilish — navbatga qo'yiladi (04-3d-pipeline). */
export async function request3d(
  storeId: string,
  productId: string,
): Promise<{ queued: number; alreadyQueued: number }> {
  const { rows } = await pool.query<{ id: string; status: string | null }>(
    `SELECT v.id, a.status
       FROM product_variants v
       JOIN products p ON p.id = v.product_id AND p.store_id = $2
       LEFT JOIN assets_3d a ON a.variant_id = v.id
      WHERE v.product_id = $1 AND v.is_active`,
    [productId, storeId],
  );

  if (rows.length === 0) throw ApiError.notFound('Mahsulot yoki variant topilmadi');

  let queued = 0;
  let alreadyQueued = 0;

  for (const variant of rows) {
    if (variant.status !== null && variant.status !== 'failed') {
      alreadyQueued += 1;
      continue;
    }

    await pool.query(
      `INSERT INTO assets_3d (variant_id, status, requested_at)
       VALUES ($1, 'queued', now())
       ON CONFLICT (variant_id)
       DO UPDATE SET status = 'queued', requested_at = now(), error_message = NULL`,
      [variant.id],
    );
    queued += 1;
  }

  return { queued, alreadyQueued };
}

export interface StoreProductRow {
  id: string;
  title: string;
  status: string;
  base_price: string;
  old_price: string | null;
  currency: string;
  images: unknown;
  has_3d: boolean;
  created_at: Date;
  created_at_key: string;
  view_count: number;
  tryon_count: number;
  category_slug: string;
  category_name: Record<string, string>;
  total_stock: string;
  reserved_stock: string;
  asset_status: string | null;
}

export async function findStoreProducts(
  storeId: string,
  query: StoreProductsQuery,
  cursor: { k: string; id: string } | null,
): Promise<StoreProductRow[]> {
  const params: unknown[] = [storeId];
  const conditions = ['p.store_id = $1'];

  if (query.status !== 'all') {
    params.push(query.status);
    conditions.push(`p.status = $${params.length}`);
  }

  if (query.category !== undefined) {
    params.push(query.category);
    conditions.push(`c.slug = $${params.length}`);
  }

  if (query.q !== undefined) {
    params.push(query.q);
    conditions.push(
      `(p.search_vec @@ plainto_tsquery('simple', $${params.length}) OR $${params.length} <% p.title)`,
    );
  }

  if (cursor) {
    params.push(cursor.k, cursor.id);
    conditions.push(
      `(p.created_at, p.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
    );
  }

  params.push(query.limit + 1);

  const { rows } = await pool.query<StoreProductRow>(
    `SELECT p.id, p.title, p.status, p.base_price, p.old_price, p.currency, p.images,
            p.has_3d, p.created_at, p.view_count, p.tryon_count,
            to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') || '+00'
              AS created_at_key,
            c.slug AS category_slug, c.name AS category_name,
            COALESCE(stock.total, 0)    AS total_stock,
            COALESCE(stock.reserved, 0) AS reserved_stock,
            stock.asset_status
       FROM products p
       JOIN categories c ON c.id = p.category_id
       CROSS JOIN LATERAL (
         SELECT SUM(vs.stock) AS total, SUM(vs.reserved) AS reserved,
                MIN(a.status)  AS asset_status
           FROM product_variants v
           LEFT JOIN variant_stock vs ON vs.variant_id = v.id
           LEFT JOIN assets_3d a ON a.variant_id = v.id
          WHERE v.product_id = p.id
       ) stock
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT $${params.length}`,
    params,
  );

  return rows;
}

/**
 * Bitta mahsulot — tahrirlash sahifasi uchun.
 * Ro'yxatdagi ma'lumot yetarli emas: variantlar, o'lchamlar, rezerv
 * miqdori va rad etish sababi kerak.
 */
export interface StoreProductDetailRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  base_price: string;
  old_price: string | null;
  currency: string;
  images: unknown;
  tags: string[];
  is_limited: boolean;
  gender: string;
  category_id: string;
  category_slug: string;
  brand_id: string | null;
  created_at: Date;
  variants: Array<{
    id: string;
    color_hex: string | null;
    color_name: Record<string, string> | null;
    price_delta: string;
    images: unknown;
    asset_status: string | null;
    sizes: Array<{ size: string; stock: number; reserved: number }> | null;
  }> | null;
}

export async function findStoreProduct(
  storeId: string,
  productId: string,
): Promise<StoreProductDetailRow> {
  const { rows } = await pool.query<StoreProductDetailRow>(
    `SELECT p.id, p.title, p.description, p.status, p.base_price, p.old_price, p.currency,
            p.images, p.tags, p.is_limited, p.gender, p.category_id, p.brand_id, p.created_at,
            c.slug AS category_slug,
            (SELECT json_agg(json_build_object(
                      'id', v.id,
                      'color_hex', v.color_hex,
                      'color_name', v.color_name,
                      -- ::text SHART: json ichida NUMERIC songa aylanadi
                      'price_delta', v.price_delta::text,
                      'images', v.images,
                      'asset_status', a.status,
                      'sizes', (SELECT json_agg(json_build_object(
                                          'size', vs.size, 'stock', vs.stock,
                                          'reserved', vs.reserved) ORDER BY vs.size)
                                  FROM variant_stock vs WHERE vs.variant_id = v.id))
                    ORDER BY v.sort_order, v.id)
               FROM product_variants v
               LEFT JOIN assets_3d a ON a.variant_id = v.id
              WHERE v.product_id = p.id AND v.is_active) AS variants
       FROM products p
       JOIN categories c ON c.id = p.category_id
      WHERE p.id = $1 AND p.store_id = $2`,
    [productId, storeId],
  );

  const product = rows[0];
  if (!product) throw ApiError.notFound('Mahsulot topilmadi');
  return product;
}
