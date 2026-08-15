import type {
  AdminOrdersQuery,
  AdminProductsQuery,
  AdminStoresQuery,
  AdminUsersQuery,
  AssetQueueQuery,
  AssetUpdateInput,
} from '@looksave/validation';

import { pool } from '../db/pool';
import { ApiError } from '../http/api-error';

/**
 * Admin panel (03-api-spec §15, 07-web-panels §5).
 *
 * Bu yerdagi amallar butun platformaga ta'sir qiladi — har biri
 * kim tomonidan qilinganini bilish uchun `app.actor_id` o'rnatiladi.
 */

// ============================================================
// Bosh sahifa
// ============================================================

/**
 * ⚠️ Hujjatda `GET /admin/analytics` bor, lekin bosh sahifa (07-web-panels §5.1)
 * uchun alohida yig'ma so'rov kerak. Shuning uchun `/admin/overview` qo'shildi.
 */
export async function getOverview() {
  const { rows } = await pool.query<Record<string, string>>(
    `SELECT
       (SELECT COUNT(*) FROM stores WHERE status = 'active')                    AS stores_active,
       (SELECT COUNT(*) FROM stores WHERE status = 'pending')                   AS stores_pending,
       (SELECT COUNT(*) FROM users WHERE is_active)                             AS users_total,
       (SELECT COUNT(*) FROM users WHERE created_at > now() - interval '7 days') AS users_week,
       (SELECT COUNT(*) FROM orders WHERE created_at > now() - interval '7 days') AS orders_week,
       (SELECT COUNT(*) FROM products WHERE status = 'pending')                 AS products_pending,
       (SELECT COUNT(*) FROM assets_3d WHERE status = 'queued')                 AS assets_queued,
       (SELECT COUNT(*) FROM assets_3d WHERE status = 'processing')             AS assets_processing,
       (SELECT COUNT(*) FROM order_blocklist WHERE store_id IS NULL)            AS global_blocks,
       (SELECT COUNT(*) FROM user_trust WHERE is_restricted
          AND (restricted_until IS NULL OR restricted_until > now()))           AS restricted_users,
       -- 24 soatdan beri javobsiz turgan buyurtmasi bor do'konlar
       (SELECT COUNT(DISTINCT store_id) FROM orders
         WHERE status = 'new' AND created_at < now() - interval '24 hours')     AS silent_stores`,
  );

  const stats = rows[0] ?? {};
  const number = (key: string): number => Number(stats[key] ?? 0);

  return {
    stores: { active: number('stores_active'), pending: number('stores_pending') },
    users: { total: number('users_total'), newThisWeek: number('users_week') },
    ordersThisWeek: number('orders_week'),
    moderation: {
      productsPending: number('products_pending'),
      assetsQueued: number('assets_queued'),
      assetsProcessing: number('assets_processing'),
    },
    attention: {
      globalBlocks: number('global_blocks'),
      restrictedUsers: number('restricted_users'),
      silentStores: number('silent_stores'),
    },
  };
}

// ============================================================
// Do'konlar
// ============================================================

interface AdminStoreRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  city: string;
  country: string;
  address: string;
  phone: string;
  logo_url: string | null;
  cover_url: string | null;
  lat: number;
  lng: number;
  created_at: Date;
  created_at_key: string;
  owner_name: string | null;
  owner_phone: string;
  reject_reason: string | null;
  product_count: string;
  order_count: string;
  avg_response_min: number | null;
  confirm_rate: string | null;
}

export async function findStores(
  query: AdminStoresQuery,
  cursor: { k: string; id: string } | null,
) {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (query.status !== 'all') {
    params.push(query.status);
    conditions.push(`s.status = $${params.length}`);
  }

  if (query.q !== undefined) {
    params.push(query.q);
    conditions.push(
      `($${params.length} <% s.name OR s.phone LIKE '%' || $${params.length} || '%')`,
    );
  }

  if (cursor) {
    params.push(cursor.k, cursor.id);
    conditions.push(
      `(s.created_at, s.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
    );
  }

  params.push(query.limit + 1);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query<AdminStoreRow>(
    `SELECT s.id, s.name, s.slug, s.status, s.city, s.country, s.address, s.phone,
            s.logo_url, s.cover_url, s.created_at, s.reject_reason, s.avg_response_min,
            s.confirm_rate::text,
            ST_Y(s.location::geometry) AS lat,
            ST_X(s.location::geometry) AS lng,
            to_char(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') || '+00'
              AS created_at_key,
            u.full_name AS owner_name, u.phone AS owner_phone,
            (SELECT COUNT(*) FROM products p WHERE p.store_id = s.id AND p.status = 'active')
              AS product_count,
            (SELECT COUNT(*) FROM orders o WHERE o.store_id = s.id) AS order_count
       FROM stores s
       JOIN users u ON u.id = s.owner_id
       ${where}
      ORDER BY s.created_at DESC, s.id DESC
      LIMIT $${params.length}`,
    params,
  );

  return rows;
}

export function toAdminStoreDto(row: AdminStoreRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    city: row.city,
    country: row.country,
    address: row.address,
    phone: row.phone,
    logoUrl: row.logo_url,
    coverUrl: row.cover_url,
    location: { lat: row.lat, lng: row.lng },
    createdAt: row.created_at.toISOString(),
    createdAtKey: row.created_at_key,
    owner: { name: row.owner_name, phone: row.owner_phone },
    rejectReason: row.reject_reason,
    productCount: Number(row.product_count),
    orderCount: Number(row.order_count),
    avgResponseMin: row.avg_response_min,
    confirmRate: row.confirm_rate === null ? null : Number(row.confirm_rate),
  };
}

const STORE_TRANSITIONS: Record<string, { to: string; from: string[] }> = {
  approve: { to: 'active', from: ['pending', 'suspended', 'rejected'] },
  reject: { to: 'rejected', from: ['pending'] },
  suspend: { to: 'suspended', from: ['active', 'pending'] },
};

export async function setStoreStatus(
  storeId: string,
  action: 'approve' | 'reject' | 'suspend',
  reason: string | null,
): Promise<{ id: string; status: string }> {
  const rule = STORE_TRANSITIONS[action];
  if (!rule) throw new ApiError('BAD_REQUEST', 'Noma`lum amal');

  const { rows } = await pool.query<{ id: string; status: string }>(
    `UPDATE stores
        SET status = $2, reject_reason = $3
      WHERE id = $1 AND status = ANY($4)
      RETURNING id, status`,
    [storeId, rule.to, reason, rule.from],
  );

  const store = rows[0];
  if (!store) {
    // Do'kon yo'q yoki allaqachon boshqa holatda
    const { rowCount } = await pool.query(`SELECT 1 FROM stores WHERE id = $1`, [storeId]);
    if ((rowCount ?? 0) === 0) throw ApiError.notFound('Do`kon topilmadi');
    throw new ApiError('INVALID_STATE', 'Do`kon holati bu amalga mos emas', {
      allowedFrom: rule.from,
    });
  }

  return store;
}

// ============================================================
// Mahsulot moderatsiyasi
// ============================================================

interface ModerationRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  base_price: string;
  currency: string;
  images: unknown;
  gender: string;
  created_at: Date;
  created_at_key: string;
  store_id: string;
  store_name: string;
  category_slug: string;
  brand_name: string | null;
  variant_count: string;
  total_stock: string;
}

export async function findProductsForModeration(
  query: AdminProductsQuery,
  cursor: { k: string; id: string } | null,
) {
  const params: unknown[] = [query.status];
  const conditions = ['p.status = $1'];

  if (query.storeId !== undefined) {
    params.push(query.storeId);
    conditions.push(`p.store_id = $${params.length}`);
  }

  if (cursor) {
    params.push(cursor.k, cursor.id);
    conditions.push(
      `(p.created_at, p.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
    );
  }

  params.push(query.limit + 1);

  const { rows } = await pool.query<ModerationRow>(
    `SELECT p.id, p.title, p.description, p.status, p.base_price, p.currency, p.images,
            p.gender, p.created_at,
            to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') || '+00'
              AS created_at_key,
            s.id AS store_id, s.name AS store_name,
            c.slug AS category_slug, b.name AS brand_name,
            (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id) AS variant_count,
            COALESCE((SELECT SUM(vs.stock) FROM product_variants v
                        JOIN variant_stock vs ON vs.variant_id = v.id
                       WHERE v.product_id = p.id), 0) AS total_stock
       FROM products p
       JOIN stores s ON s.id = p.store_id
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN brands b ON b.id = p.brand_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT $${params.length}`,
    params,
  );

  return rows;
}

export function toModerationDto(row: ModerationRow) {
  const images = Array.isArray(row.images) ? row.images : [];
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    price: row.base_price,
    currency: row.currency,
    images,
    gender: row.gender,
    createdAt: row.created_at.toISOString(),
    createdAtKey: row.created_at_key,
    store: { id: row.store_id, name: row.store_name },
    categorySlug: row.category_slug,
    brandName: row.brand_name,
    variantCount: Number(row.variant_count),
    totalStock: Number(row.total_stock),
  };
}

export async function setProductStatus(
  productId: string,
  status: 'active' | 'rejected',
): Promise<{ id: string; status: string }> {
  const { rows } = await pool.query<{ id: string; status: string }>(
    `UPDATE products SET status = $2
      WHERE id = $1 AND status IN ('pending', 'rejected', 'active')
      RETURNING id, status`,
    [productId, status],
  );

  const product = rows[0];
  if (!product) throw ApiError.notFound('Mahsulot topilmadi yoki holati mos emas');
  return product;
}

// ============================================================
// 3D navbat
// ============================================================

interface AssetRow {
  id: string;
  variant_id: string;
  status: string;
  glb_url: string | null;
  thumbnail_url: string | null;
  poly_count: number | null;
  file_size_bytes: number | null;
  requested_at: Date | null;
  completed_at: Date | null;
  error_message: string | null;
  qa_result: unknown;
  product_id: string;
  product_title: string;
  product_images: unknown;
  variant_images: unknown;
  color_name: Record<string, string> | null;
  store_name: string;
  slot: string;
}

export async function findAssetQueue(query: AssetQueueQuery) {
  const params: unknown[] = [];
  const where = query.status === 'all' ? '' : `WHERE a.status = $${params.push(query.status)}`;

  params.push(query.limit);

  const { rows } = await pool.query<AssetRow>(
    `SELECT a.id, a.variant_id, a.status, a.glb_url, a.thumbnail_url, a.poly_count,
            a.file_size_bytes, a.requested_at, a.completed_at, a.error_message, a.qa_result,
            p.id AS product_id, p.title AS product_title, p.images AS product_images, p.slot,
            v.images AS variant_images, v.color_name,
            s.name AS store_name
       FROM assets_3d a
       JOIN product_variants v ON v.id = a.variant_id
       JOIN products p ON p.id = v.product_id
       JOIN stores s ON s.id = p.store_id
       ${where}
      ORDER BY a.requested_at NULLS LAST, a.created_at
      LIMIT $${params.length}`,
    params,
  );

  return rows;
}

export function toAssetDto(row: AssetRow) {
  const sources = [
    ...(Array.isArray(row.variant_images) ? row.variant_images : []),
    ...(Array.isArray(row.product_images) ? row.product_images : []),
  ].filter((url): url is string => typeof url === 'string');

  return {
    id: row.id,
    variantId: row.variant_id,
    status: row.status,
    glbUrl: row.glb_url,
    thumbnailUrl: row.thumbnail_url,
    polyCount: row.poly_count,
    fileSizeBytes: row.file_size_bytes,
    requestedAt: row.requested_at?.toISOString() ?? null,
    completedAt: row.completed_at?.toISOString() ?? null,
    errorMessage: row.error_message,
    qaResult: row.qa_result,
    product: { id: row.product_id, title: row.product_title, slot: row.slot },
    colorName: row.color_name,
    storeName: row.store_name,
    // Modelchi uchun manba fotolar — nechta borligi ishga olish qaroriga ta'sir qiladi
    sourceImages: sources,
  };
}

export async function updateAsset(
  assetId: string,
  input: AssetUpdateInput,
): Promise<{ id: string; status: string }> {
  const fields = ['status = $2'];
  const params: unknown[] = [assetId, input.status];

  const push = (column: string, value: unknown): void => {
    params.push(value);
    fields.push(`${column} = $${params.length}`);
  };

  if (input.glbUrl !== undefined) push('glb_url', input.glbUrl);
  if (input.lodUrls !== undefined) push('lod_urls', JSON.stringify(input.lodUrls));
  if (input.thumbnailUrl !== undefined) push('thumbnail_url', input.thumbnailUrl);
  if (input.fileSizeBytes !== undefined) push('file_size_bytes', input.fileSizeBytes);
  if (input.polyCount !== undefined) push('poly_count', input.polyCount);
  if (input.textureSize !== undefined) push('texture_size', input.textureSize);
  if (input.qaResult !== undefined) push('qa_result', JSON.stringify(input.qaResult));
  if (input.errorMessage !== undefined) push('error_message', input.errorMessage);

  push('hide_body_parts', input.hideBodyParts);
  push('has_morphs', input.hasMorphs);

  if (input.status === 'ready') {
    fields.push('completed_at = now()');
  }

  // `products.has_3d` triggerda avtomatik yangilanadi (007_functions.sql)
  const { rows } = await pool.query<{ id: string; status: string }>(
    `UPDATE assets_3d SET ${fields.join(', ')} WHERE id = $1 RETURNING id, status`,
    params,
  );

  const asset = rows[0];
  if (!asset) throw ApiError.notFound('3D yozuv topilmadi');
  return asset;
}

// ============================================================
// Qora ro'yxat va foydalanuvchilar
// ============================================================

export async function findGlobalBlocks() {
  const { rows } = await pool.query<{
    id: string;
    phone: string;
    reason: string;
    created_at: Date;
    store_reasons: Array<{ store: string; reason: string }> | null;
  }>(
    `SELECT g.id, g.phone, g.reason, g.created_at,
            (SELECT json_agg(json_build_object('store', s.name, 'reason', b.reason))
               FROM order_blocklist b
               JOIN stores s ON s.id = b.store_id
              WHERE b.phone = g.phone) AS store_reasons
       FROM order_blocklist g
      WHERE g.store_id IS NULL
      ORDER BY g.created_at DESC
      LIMIT 100`,
  );

  return rows.map((row) => ({
    id: row.id,
    phone: row.phone,
    reason: row.reason,
    createdAt: row.created_at.toISOString(),
    // Uch do'kon ham xato qilishi mumkin — admin sabablarni ko'rib qaror qiladi
    storeReasons: row.store_reasons ?? [],
  }));
}

export async function removeBlock(id: string): Promise<void> {
  const { rowCount } = await pool.query(`DELETE FROM order_blocklist WHERE id = $1`, [id]);
  if ((rowCount ?? 0) === 0) throw ApiError.notFound('Yozuv topilmadi');
}

export async function findUsers(query: AdminUsersQuery) {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (query.restricted) {
    conditions.push(
      `t.is_restricted AND (t.restricted_until IS NULL OR t.restricted_until > now())`,
    );
  }

  if (query.q !== undefined) {
    params.push(query.q);
    conditions.push(
      `(u.phone LIKE '%' || $${params.length} || '%' OR $${params.length} <% u.full_name)`,
    );
  }

  params.push(query.limit);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query<{
    id: string;
    phone: string;
    full_name: string | null;
    role: string;
    country: string | null;
    created_at: Date;
    orders_total: number | null;
    orders_completed: number | null;
    orders_cancelled: number | null;
    orders_noshow: number | null;
    is_restricted: boolean | null;
    restricted_until: Date | null;
    restriction_note: string | null;
  }>(
    `SELECT u.id, u.phone, u.full_name, u.role, u.country, u.created_at,
            t.orders_total, t.orders_completed, t.orders_cancelled, t.orders_noshow,
            t.is_restricted, t.restricted_until, t.restriction_note
       FROM users u
       LEFT JOIN user_trust t ON t.user_id = u.id
       ${where}
      ORDER BY u.created_at DESC
      LIMIT $${params.length}`,
    params,
  );

  return rows.map((row) => ({
    id: row.id,
    phone: row.phone,
    fullName: row.full_name,
    role: row.role,
    country: row.country,
    createdAt: row.created_at.toISOString(),
    trust: {
      total: row.orders_total ?? 0,
      completed: row.orders_completed ?? 0,
      cancelled: row.orders_cancelled ?? 0,
      noshow: row.orders_noshow ?? 0,
      isRestricted: row.is_restricted ?? false,
      restrictedUntil: row.restricted_until?.toISOString() ?? null,
      note: row.restriction_note,
    },
  }));
}

export async function unrestrictUser(userId: string): Promise<void> {
  const { rowCount } = await pool.query(
    `UPDATE user_trust
        SET is_restricted = false, restricted_until = NULL,
            restriction_note = NULL, updated_at = now()
      WHERE user_id = $1`,
    [userId],
  );
  if ((rowCount ?? 0) === 0) throw ApiError.notFound('Foydalanuvchi topilmadi');
}

// ============================================================
// Buyurtmalar (03-api-spec §15)
// ============================================================

interface AdminOrderRow {
  id: string;
  order_number: string;
  status: string;
  created_at: Date;
  created_at_key: string;
  delivery_type: string;
  total: string;
  currency: string;
  contact_name: string;
  contact_phone: string;
  store_id: string;
  store_name: string;
  customer_id: string;
  reject_reason: string | null;
  cancel_reason: string | null;
  item_count: string;
}

/**
 * Admin uchun barcha buyurtmalar — nizolarni hal qilish uchun.
 * Do'kon paneli faqat o'z buyurtmalarini ko'radi, bu esa hammasini.
 */
export async function findAllOrders(
  query: AdminOrdersQuery,
  cursor: { k: string; id: string } | null,
) {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (query.status !== 'all') {
    params.push(query.status);
    conditions.push(`o.status = $${params.length}`);
  }

  if (query.storeId !== undefined) {
    params.push(query.storeId);
    conditions.push(`o.store_id = $${params.length}`);
  }

  if (query.q !== undefined) {
    // Buyurtma raqami yoki telefon bo'yicha — qo'llab-quvvatlash
    // xizmatiga mijoz shu ikkisidan birini aytadi
    params.push(query.q);
    conditions.push(
      `(o.order_number ILIKE '%' || $${params.length} || '%'
        OR o.contact_phone LIKE '%' || $${params.length} || '%')`,
    );
  }

  if (cursor) {
    params.push(cursor.k, cursor.id);
    conditions.push(
      `(o.created_at, o.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
    );
  }

  params.push(query.limit + 1);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query<AdminOrderRow>(
    `SELECT o.id, o.order_number, o.status, o.created_at, o.delivery_type, o.total,
            o.currency, o.contact_name, o.contact_phone, o.reject_reason, o.cancel_reason,
            o.user_id AS customer_id,
            to_char(o.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') || '+00'
              AS created_at_key,
            s.id AS store_id, s.name AS store_name,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
       FROM orders o
       JOIN stores s ON s.id = o.store_id
       ${where}
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT $${params.length}`,
    params,
  );

  return rows;
}

export function toAdminOrderDto(row: AdminOrderRow) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    createdAtKey: row.created_at_key,
    deliveryType: row.delivery_type,
    total: row.total,
    currency: row.currency,
    itemCount: Number(row.item_count),
    customer: { id: row.customer_id, name: row.contact_name, phone: row.contact_phone },
    store: { id: row.store_id, name: row.store_name },
    reason: row.reject_reason ?? row.cancel_reason,
  };
}

/** Nizolarni hal qilish uchun to'liq status tarixi. */
export async function findOrderEvents(orderId: string) {
  const { rows } = await pool.query<{
    from_status: string | null;
    to_status: string;
    actor_type: string;
    channel: string | null;
    comment: string | null;
    created_at: Date;
  }>(
    `SELECT from_status, to_status, actor_type, channel, comment, created_at
       FROM order_events WHERE order_id = $1 ORDER BY created_at`,
    [orderId],
  );

  return rows.map((row) => ({
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actorType: row.actor_type,
    channel: row.channel,
    comment: row.comment,
    createdAt: row.created_at.toISOString(),
  }));
}
