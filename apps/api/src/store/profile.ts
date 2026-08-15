import type { UpdateStoreInput } from '@looksave/validation';

import { computeOpenState } from '../catalog/hours';
import { pool } from '../db/pool';
import { ApiError } from '../http/api-error';
import { isOwnCdnUrl } from '../integrations/r2';

/**
 * Do'kon sozlamalari (07-web-panels §4.8).
 *
 * Bu yerdagi ikki maydon boshqalardan muhimroq:
 *
 * **Ish vaqti** — `isOpen` shundan hisoblanadi va katalogda ko'rinadi.
 * Noto'g'ri bo'lsa mijoz yopiq do'konga buyurtma beradi va javob kutadi.
 *
 * **Joylashuv** — `ST_DWithin` yetkazish radiusi shundan o'lchanadi.
 * Xato pin qo'yilsa, hududdagi mijozlar `OUT_OF_RANGE` oladi.
 */

interface StoreRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  address: string;
  landmark: string | null;
  city: string;
  country: 'UZ' | 'AE';
  phone: string;
  lat: number;
  lng: number;
  working_hours: unknown;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  delivery_radius_m: number;
  delivery_fee: string;
  free_delivery_from: string | null;
  currency: string;
  status: string;
  reject_reason: string | null;
  rating: string;
  review_count: number;
}

async function loadStore(storeId: string): Promise<StoreRow> {
  const { rows } = await pool.query<StoreRow>(
    `SELECT s.id, s.name, s.slug, s.description, s.logo_url, s.cover_url, s.address,
            s.landmark, s.city, s.country, s.phone, s.working_hours, s.delivery_enabled,
            s.pickup_enabled, s.delivery_radius_m, s.delivery_fee, s.free_delivery_from,
            s.currency, s.status, s.reject_reason, s.rating, s.review_count,
            ST_Y(s.location::geometry) AS lat,
            ST_X(s.location::geometry) AS lng
       FROM stores s WHERE s.id = $1`,
    [storeId],
  );

  const store = rows[0];
  if (!store) throw ApiError.notFound('Do`kon topilmadi');
  return store;
}

export async function getStoreProfile(storeId: string) {
  const store = await loadStore(storeId);
  const open = computeOpenState(store.working_hours, store.country);

  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    description: store.description,
    logoUrl: store.logo_url,
    coverUrl: store.cover_url,
    address: store.address,
    landmark: store.landmark,
    city: store.city,
    country: store.country,
    phone: store.phone,
    location: { lat: store.lat, lng: store.lng },
    workingHours: Array.isArray(store.working_hours) ? store.working_hours : [],
    isOpen: open.isOpen,
    closesAt: open.closesAt,
    opensAt: open.opensAt,
    delivery: {
      enabled: store.delivery_enabled,
      radiusM: store.delivery_radius_m,
      // Pul string bo'lib qoladi
      fee: store.delivery_fee,
      freeFrom: store.free_delivery_from,
    },
    pickupEnabled: store.pickup_enabled,
    currency: store.currency,
    status: store.status,
    rejectReason: store.reject_reason,
    rating: Number(store.rating),
    reviewCount: store.review_count,
  };
}

export async function updateStoreProfile(storeId: string, input: UpdateStoreInput) {
  const current = await loadStore(storeId);

  // Yoqilgan usullardan kamida bittasi qolishi kerak — ikkalasi
  // o'chirilsa do'konga buyurtma umuman berib bo'lmaydi
  const deliveryEnabled = input.deliveryEnabled ?? current.delivery_enabled;
  const pickupEnabled = input.pickupEnabled ?? current.pickup_enabled;
  if (!deliveryEnabled && !pickupEnabled) {
    throw new ApiError('INVALID_STATE', 'Yetkazish yoki olib ketishdan biri yoqilgan bo`lsin');
  }

  for (const url of [input.logoUrl, input.coverUrl]) {
    if (typeof url === 'string' && !isOwnCdnUrl(url)) {
      throw new ApiError('BAD_REQUEST', 'Rasm faqat presign orqali yuklanishi kerak');
    }
  }

  const fields: string[] = [];
  const params: unknown[] = [storeId];

  const push = (column: string, value: unknown): void => {
    params.push(value);
    fields.push(`${column} = $${params.length}`);
  };

  if (input.name !== undefined) push('name', input.name);
  if (input.description !== undefined) push('description', input.description);
  if (input.phone !== undefined) push('phone', input.phone);
  if (input.logoUrl !== undefined) push('logo_url', input.logoUrl);
  if (input.coverUrl !== undefined) push('cover_url', input.coverUrl);
  if (input.address !== undefined) push('address', input.address);
  if (input.landmark !== undefined) push('landmark', input.landmark);
  if (input.workingHours !== undefined) push('working_hours', JSON.stringify(input.workingHours));
  if (input.deliveryEnabled !== undefined) push('delivery_enabled', input.deliveryEnabled);
  if (input.pickupEnabled !== undefined) push('pickup_enabled', input.pickupEnabled);
  if (input.deliveryRadiusM !== undefined) push('delivery_radius_m', input.deliveryRadiusM);
  if (input.deliveryFee !== undefined) push('delivery_fee', input.deliveryFee);
  if (input.freeDeliveryFrom !== undefined) push('free_delivery_from', input.freeDeliveryFrom);

  if (input.location !== undefined) {
    params.push(input.location.lng, input.location.lat);
    fields.push(`location = ST_MakePoint($${params.length - 1}, $${params.length})::geography`);
  }

  if (fields.length > 0) {
    await pool.query(`UPDATE stores SET ${fields.join(', ')} WHERE id = $1`, params);
  }

  return getStoreProfile(storeId);
}
