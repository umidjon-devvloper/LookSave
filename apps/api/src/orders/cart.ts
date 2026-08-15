import type { Locale } from '@looksave/shared-types';
import type { CartItemInput } from '@looksave/validation';

import { pool } from '../db/pool';
import { ApiError } from '../http/api-error';
import { pickName } from '../catalog/locale';

export interface CartRow {
  item_id: string;
  variant_id: string;
  product_id: string;
  title: string;
  color_name: Record<string, string> | null;
  product_images: unknown;
  variant_images: unknown;
  size: string;
  qty: number;
  base_price: string;
  price_delta: string;
  currency: string;
  stock: number | null;
  reserved: number | null;
  store_id: string;
  store_name: string;
  store_currency: string;
  delivery_fee: string;
  free_delivery_from: string | null;
  product_status: string;
  store_status: string;
}

/** Foydalanuvchining savati. Yo'q bo'lsa yaratiladi (ro'yxatdan o'tishda ham yaratiladi). */
async function ensureCartId(userId: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO carts (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
     RETURNING id`,
    [userId],
  );
  const cart = rows[0];
  if (!cart) throw ApiError.internal('Savat yaratilmadi');
  return cart.id;
}

async function loadCartRows(userId: string): Promise<CartRow[]> {
  const { rows } = await pool.query<CartRow>(
    `SELECT ci.id AS item_id, ci.variant_id, ci.size, ci.qty,
            p.id AS product_id, p.title, p.images AS product_images,
            p.base_price, p.currency, p.status AS product_status,
            v.color_name, v.images AS variant_images, v.price_delta,
            vs.stock, vs.reserved,
            s.id AS store_id, s.name AS store_name, s.currency AS store_currency,
            s.delivery_fee, s.free_delivery_from, s.status AS store_status
       FROM carts c
       JOIN cart_items ci ON ci.cart_id = c.id
       JOIN product_variants v ON v.id = ci.variant_id
       JOIN products p ON p.id = v.product_id
       JOIN stores s ON s.id = p.store_id
       LEFT JOIN variant_stock vs ON vs.variant_id = v.id AND vs.size = ci.size
      WHERE c.user_id = $1
      ORDER BY s.name, ci.added_at`,
    [userId],
  );
  return rows;
}

/** Pul string bo'lib qoladi — qo'shish `NUMERIC` mantig'ida, tiyin aniqligida. */
function addMoney(a: string, b: string): string {
  const cents = Math.round(Number(a) * 100) + Math.round(Number(b) * 100);
  return (cents / 100).toFixed(2);
}

function multiplyMoney(amount: string, qty: number): string {
  return ((Math.round(Number(amount) * 100) * qty) / 100).toFixed(2);
}

function firstImage(...sources: unknown[]): string | null {
  for (const source of sources) {
    if (Array.isArray(source) && typeof source[0] === 'string') return source[0];
  }
  return null;
}

export interface CartItemDto {
  id: string;
  variantId: string;
  productId: string;
  title: string;
  colorName: string;
  image: string | null;
  size: string;
  qty: number;
  unitPrice: string;
  totalPrice: string;
  available: boolean;
  stock: number;
}

export interface CartStoreDto {
  store: { id: string; name: string; currency: string };
  items: CartItemDto[];
  subtotal: string;
  deliveryFee: string;
  total: string;
}

/**
 * Savat DO'KONLAR BO'YICHA bo'linadi (03-api-spec §11).
 * Har do'kon alohida buyurtma: biri tasdiqlab, biri rad etsa
 * bitta buyurtma ichida holat chalkashib ketardi.
 */
export function buildCart(
  rows: CartRow[],
  locale: Locale,
): { stores: CartStoreDto[]; itemCount: number } {
  const byStore = new Map<string, CartStoreDto>();

  for (const row of rows) {
    const unitPrice = addMoney(row.base_price, row.price_delta);
    const available =
      row.product_status === 'active' &&
      row.store_status === 'active' &&
      (row.stock ?? 0) - (row.reserved ?? 0) >= row.qty;

    const item: CartItemDto = {
      id: row.item_id,
      variantId: row.variant_id,
      productId: row.product_id,
      title: row.title,
      colorName: pickName(row.color_name, locale),
      image: firstImage(row.variant_images, row.product_images),
      size: row.size,
      qty: row.qty,
      unitPrice,
      totalPrice: multiplyMoney(unitPrice, row.qty),
      available,
      stock: Math.max(0, (row.stock ?? 0) - (row.reserved ?? 0)),
    };

    const existing = byStore.get(row.store_id);
    if (existing) {
      existing.items.push(item);
      existing.subtotal = addMoney(existing.subtotal, item.totalPrice);
    } else {
      byStore.set(row.store_id, {
        store: { id: row.store_id, name: row.store_name, currency: row.store_currency },
        items: [item],
        subtotal: item.totalPrice,
        deliveryFee: row.delivery_fee,
        total: '0.00',
      });
    }
  }

  const stores = [...byStore.values()].map((group) => {
    const rowForStore = rows.find((row) => row.store_id === group.store.id);
    const freeFrom = rowForStore?.free_delivery_from ?? null;

    // Bepul yetkazish chegarasi — faqat mavjud mahsulotlar summasidan emas,
    // butun do'kon savatidan hisoblanadi
    const deliveryFee =
      freeFrom !== null && Number(group.subtotal) >= Number(freeFrom) ? '0.00' : group.deliveryFee;

    return { ...group, deliveryFee, total: addMoney(group.subtotal, deliveryFee) };
  });

  return { stores, itemCount: rows.reduce((sum, row) => sum + row.qty, 0) };
}

export async function getCart(userId: string, locale: Locale) {
  return buildCart(await loadCartRows(userId), locale);
}

/**
 * Savatga qo'shish. Bir xil variant+o'lcham bo'lsa miqdor QO'SHILADI,
 * yangi qator yaratilmaydi (`UNIQUE (cart_id, variant_id, size)`).
 */
export async function addCartItem(userId: string, input: CartItemInput): Promise<void> {
  const cartId = await ensureCartId(userId);

  const { rows } = await pool.query<{ available: number }>(
    `SELECT GREATEST(0, vs.stock - vs.reserved) AS available
       FROM variant_stock vs
       JOIN product_variants v ON v.id = vs.variant_id AND v.is_active
       JOIN products p ON p.id = v.product_id AND p.status = 'active'
       JOIN stores s ON s.id = p.store_id AND s.status = 'active'
      WHERE vs.variant_id = $1 AND vs.size = $2`,
    [input.variantId, input.size],
  );

  const stock = rows[0];
  if (!stock) throw ApiError.notFound('Bunday mahsulot yoki o`lcham yo`q');

  const { rows: existingRows } = await pool.query<{ qty: number }>(
    `SELECT qty FROM cart_items WHERE cart_id = $1 AND variant_id = $2 AND size = $3`,
    [cartId, input.variantId, input.size],
  );

  const wanted = (existingRows[0]?.qty ?? 0) + input.qty;
  if (wanted > stock.available) {
    throw new ApiError('OUT_OF_STOCK', 'Omborda yetarli emas', {
      available: stock.available,
      requested: wanted,
    });
  }
  if (wanted > 10) {
    throw new ApiError('OUT_OF_RANGE', 'Bitta mahsulotdan 10 tadan ko`p bo`lmasin');
  }

  await pool.query(
    `INSERT INTO cart_items (cart_id, variant_id, size, qty)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (cart_id, variant_id, size)
     DO UPDATE SET qty = cart_items.qty + EXCLUDED.qty`,
    [cartId, input.variantId, input.size, input.qty],
  );
}

export async function updateCartItem(userId: string, itemId: string, qty: number): Promise<void> {
  const { rows } = await pool.query<{ available: number }>(
    `SELECT GREATEST(0, vs.stock - vs.reserved) AS available
       FROM cart_items ci
       JOIN carts c ON c.id = ci.cart_id AND c.user_id = $1
       JOIN variant_stock vs ON vs.variant_id = ci.variant_id AND vs.size = ci.size
      WHERE ci.id = $2`,
    [userId, itemId],
  );

  const stock = rows[0];
  if (!stock) throw ApiError.notFound('Savatda bunday qator yo`q');

  if (qty > stock.available) {
    throw new ApiError('OUT_OF_STOCK', 'Omborda yetarli emas', { available: stock.available });
  }

  await pool.query(
    `UPDATE cart_items ci SET qty = $3
       FROM carts c
      WHERE ci.cart_id = c.id AND c.user_id = $1 AND ci.id = $2`,
    [userId, itemId, qty],
  );
}

export async function removeCartItem(userId: string, itemId: string): Promise<void> {
  const { rowCount } = await pool.query(
    `DELETE FROM cart_items ci
      USING carts c
      WHERE ci.cart_id = c.id AND c.user_id = $1 AND ci.id = $2`,
    [userId, itemId],
  );
  if ((rowCount ?? 0) === 0) throw ApiError.notFound('Savatda bunday qator yo`q');
}

export async function clearCart(userId: string): Promise<void> {
  await pool.query(
    `DELETE FROM cart_items ci USING carts c WHERE ci.cart_id = c.id AND c.user_id = $1`,
    [userId],
  );
}

/** Buyurtma berilgandan keyin faqat SHU do'kon qatorlari o'chiriladi. */
export async function clearStoreItems(userId: string, storeId: string): Promise<void> {
  await pool.query(
    `DELETE FROM cart_items ci
      USING carts c, product_variants v, products p
      WHERE ci.cart_id = c.id AND c.user_id = $1
        AND v.id = ci.variant_id AND p.id = v.product_id AND p.store_id = $2`,
    [userId, storeId],
  );
}
