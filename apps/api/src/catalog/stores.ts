import type { NearbyQuery, StoreMapQuery } from '@looksave/validation';

import { pool } from '../db/pool';
import { computeOpenState } from './hours';

interface NearbyRow {
  id: string;
  name: string;
  logo_url: string | null;
  address: string;
  distance_m: number;
  rating: string;
  currency: string;
  lat: number;
  lng: number;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  working_hours: unknown;
  country: 'UZ' | 'AE';
  product_count: string;
  product_3d_count: string;
}

/**
 * Yaqin do'konlar (03-api-spec §8, 02-database §10.1).
 *
 * `ST_DWithin` GIST index'dan foydalanadi — bu bo'lmasa butun jadval
 * skanerlanadi. Saralash `<->` (KNN) bilan.
 *
 * Mahsulot sanoqlari LATERAL orqali: do'kon qatoriga JOIN qilinsa
 * GROUP BY kerak bo'ladi va katalog o'sganda so'rov og'irlashadi.
 */
export async function findNearbyStores(query: NearbyQuery): Promise<NearbyRow[]> {
  const conditions: string[] = [
    `s.status = 'active'`,
    `ST_DWithin(s.location, ST_MakePoint($1, $2)::geography, $3)`,
  ];
  const params: unknown[] = [query.lng, query.lat, query.radius];

  if (query.category !== undefined) {
    params.push(query.category);
    conditions.push(`EXISTS (
      SELECT 1 FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE p.store_id = s.id AND p.status = 'active' AND c.slug = $${params.length}
    )`);
  }

  if (query.only3d) {
    conditions.push(`EXISTS (
      SELECT 1 FROM products p WHERE p.store_id = s.id AND p.status = 'active' AND p.has_3d
    )`);
  }

  params.push(query.limit);
  const limitIndex = params.length;

  const { rows } = await pool.query<NearbyRow>(
    `SELECT s.id, s.name, s.logo_url, s.address, s.rating, s.currency,
            s.delivery_enabled, s.pickup_enabled, s.working_hours, s.country,
            ST_Distance(s.location, ST_MakePoint($1, $2)::geography)::int AS distance_m,
            ST_Y(s.location::geometry) AS lat,
            ST_X(s.location::geometry) AS lng,
            counts.product_count,
            counts.product_3d_count
       FROM stores s
       CROSS JOIN LATERAL (
         SELECT COUNT(*) FILTER (WHERE p.status = 'active')             AS product_count,
                COUNT(*) FILTER (WHERE p.status = 'active' AND p.has_3d) AS product_3d_count
           FROM products p WHERE p.store_id = s.id
       ) counts
      WHERE ${conditions.join(' AND ')}
      ORDER BY s.location <-> ST_MakePoint($1, $2)::geography
      LIMIT $${limitIndex}`,
    params,
  );

  return rows;
}

export interface NearbyStoreDto {
  id: string;
  name: string;
  logoUrl: string | null;
  address: string;
  distanceM: number;
  rating: number;
  isOpen: boolean;
  closesAt: string | null;
  opensAt: string | null;
  productCount: number;
  product3dCount: number;
  currency: string;
  location: { lat: number; lng: number };
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
}

export function toNearbyDto(row: NearbyRow): NearbyStoreDto {
  const open = computeOpenState(row.working_hours, row.country);

  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logo_url,
    address: row.address,
    distanceM: row.distance_m,
    rating: Number(row.rating),
    isOpen: open.isOpen,
    closesAt: open.closesAt,
    opensAt: open.opensAt,
    productCount: Number(row.product_count),
    product3dCount: Number(row.product_3d_count),
    currency: row.currency,
    location: { lat: row.lat, lng: row.lng },
    deliveryEnabled: row.delivery_enabled,
    pickupEnabled: row.pickup_enabled,
  };
}

interface StoreDetailRow {
  id: string;
  name: string;
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
  rating: string;
  review_count: number;
  avg_response_min: number | null;
  delivery_enabled: boolean;
  delivery_radius_m: number;
  delivery_fee: string;
  free_delivery_from: string | null;
  pickup_enabled: boolean;
  currency: string;
}

export async function findStoreById(id: string): Promise<StoreDetailRow | null> {
  const { rows } = await pool.query<StoreDetailRow>(
    `SELECT s.id, s.name, s.description, s.logo_url, s.cover_url, s.address, s.landmark,
            s.city, s.country, s.phone, s.working_hours, s.rating, s.review_count,
            s.avg_response_min, s.delivery_enabled, s.delivery_radius_m, s.delivery_fee,
            s.free_delivery_from, s.pickup_enabled, s.currency,
            ST_Y(s.location::geometry) AS lat,
            ST_X(s.location::geometry) AS lng
       FROM stores s
      WHERE s.id = $1 AND s.status = 'active'`,
    [id],
  );
  return rows[0] ?? null;
}

interface StoreCategoryRow {
  id: string;
  slug: string;
  name: Record<string, string>;
  count: string;
}

/** Do'kon sahifasidagi kategoriya filtri — faqat mahsuloti bor kategoriyalar. */
export async function findStoreCategories(storeId: string): Promise<StoreCategoryRow[]> {
  const { rows } = await pool.query<StoreCategoryRow>(
    `SELECT c.id, c.slug, c.name, COUNT(p.id) AS count
       FROM products p
       JOIN categories c ON c.id = p.category_id
      WHERE p.store_id = $1 AND p.status = 'active'
      GROUP BY c.id, c.slug, c.name, c.sort_order
      ORDER BY c.sort_order, c.slug`,
    [storeId],
  );
  return rows;
}

export interface StoreDetailDto {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  address: string;
  landmark: string | null;
  city: string;
  phone: string;
  location: { lat: number; lng: number };
  workingHours: unknown;
  isOpen: boolean;
  closesAt: string | null;
  opensAt: string | null;
  rating: number;
  reviewCount: number;
  avgResponseMin: number | null;
  delivery: {
    enabled: boolean;
    radiusM: number;
    fee: string;
    freeFrom: string | null;
  };
  pickupEnabled: boolean;
  currency: string;
  categories: Array<{ id: string; slug: string; name: string; count: number }>;
}

export function toStoreDetailDto(
  row: StoreDetailRow,
  categories: StoreCategoryRow[],
  pickName: (name: Record<string, string>) => string,
): StoreDetailDto {
  const open = computeOpenState(row.working_hours, row.country);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    logoUrl: row.logo_url,
    coverUrl: row.cover_url,
    address: row.address,
    landmark: row.landmark,
    city: row.city,
    phone: row.phone,
    location: { lat: row.lat, lng: row.lng },
    workingHours: row.working_hours,
    isOpen: open.isOpen,
    closesAt: open.closesAt,
    opensAt: open.opensAt,
    rating: Number(row.rating),
    reviewCount: row.review_count,
    avgResponseMin: row.avg_response_min,
    delivery: {
      enabled: row.delivery_enabled,
      radiusM: row.delivery_radius_m,
      // Pul string bo'lib qoladi — NUMERIC(12,2)
      fee: row.delivery_fee,
      freeFrom: row.free_delivery_from,
    },
    pickupEnabled: row.pickup_enabled,
    currency: row.currency,
    categories: categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      name: pickName(category.name),
      count: Number(category.count),
    })),
  };
}

interface MarkerRow {
  id: string;
  name: string;
  logo_url: string | null;
  lat: number;
  lng: number;
}

interface ClusterRow {
  lat: number;
  lng: number;
  count: string;
}

/**
 * Xarita: zoom past bo'lsa klaster, yuqori bo'lsa marker (03-api-spec §8).
 *
 * Klasterlash `ST_SnapToGrid` bilan — katak o'lchami zoom'ga bog'liq.
 * Bu K-means'dan sodda va tezroq; xarita klasteri uchun aniqlik yetarli.
 */
export async function findStoresInBounds(
  query: StoreMapQuery,
): Promise<{ clusters: Array<{ lat: number; lng: number; count: number }>; markers: MarkerRow[] }> {
  const bounds = [query.swLng, query.swLat, query.neLng, query.neLat];

  if (query.zoom >= 12) {
    const { rows } = await pool.query<MarkerRow>(
      `SELECT s.id, s.name, s.logo_url,
              ST_Y(s.location::geometry) AS lat,
              ST_X(s.location::geometry) AS lng
         FROM stores s
        WHERE s.status = 'active'
          AND s.location::geometry && ST_MakeEnvelope($1, $2, $3, $4, 4326)
        LIMIT 300`,
      bounds,
    );
    return { clusters: [], markers: rows };
  }

  // zoom 1 → ~10°, zoom 11 → ~0.01°
  const cell = Math.max(0.01, 20 / 2 ** query.zoom);

  const { rows } = await pool.query<ClusterRow>(
    `SELECT ST_Y(ST_Centroid(ST_Collect(s.location::geometry))) AS lat,
            ST_X(ST_Centroid(ST_Collect(s.location::geometry))) AS lng,
            COUNT(*) AS count
       FROM stores s
      WHERE s.status = 'active'
        AND s.location::geometry && ST_MakeEnvelope($1, $2, $3, $4, 4326)
      GROUP BY ST_SnapToGrid(s.location::geometry, $5)
      LIMIT 200`,
    [...bounds, cell],
  );

  return {
    clusters: rows.map((row) => ({ lat: row.lat, lng: row.lng, count: Number(row.count) })),
    markers: [],
  };
}
